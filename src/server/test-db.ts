import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { ensureSchema } from "@/db/ensure";
import type { JournalDb } from "@/db/types";
import * as schema from "@/db/schema";

export async function createTestDb(): Promise<JournalDb> {
  const client = new PGlite();
  await ensureSchema((statement) => client.exec(statement));
  return drizzle(client, { schema });
}
