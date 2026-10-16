import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzleFile } from "drizzle-orm/pglite";
import { seedHandles } from "@/server/journal";
import { ensureSchema } from "./ensure";
import * as schema from "./schema";
import type { JournalDb } from "./types";

type JournalState = {
  db: JournalDb;
  ready: Promise<void>;
  close?: () => Promise<void>;
};

const globalForDb = globalThis as unknown as {
  journalDb?: JournalState;
};

function openNeon(databaseUrl: string): JournalState {
  const sql = neon(databaseUrl);
  const db = drizzleNeon(sql, { schema });
  return {
    db,
    ready: ensureSchema((statement) => sql.query(statement)).then(() => seedHandles(db)),
  };
}

function openFile(): JournalState {
  const dataDir = path.join(process.cwd(), "data", "journal-live");
  fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzleFile(client, { schema });
  return {
    db,
    close: () => client.close(),
    ready: ensureSchema((statement) => client.exec(statement)).then(() => seedHandles(db)),
  };
}

function openJournal(): JournalState {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) return openNeon(databaseUrl);
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is required on Vercel");
  }
  return openFile();
}

async function dropJournal() {
  const current = globalForDb.journalDb;
  globalForDb.journalDb = undefined;
  await current?.close?.().catch(() => undefined);
}

export async function getDb(): Promise<JournalDb> {
  if (globalForDb.journalDb) {
    try {
      await globalForDb.journalDb.ready;
      return globalForDb.journalDb.db;
    } catch {
      await dropJournal();
    }
  }

  globalForDb.journalDb = openJournal();
  try {
    await globalForDb.journalDb.ready;
  } catch (error) {
    await dropJournal();
    throw error;
  }
  return globalForDb.journalDb.db;
}
