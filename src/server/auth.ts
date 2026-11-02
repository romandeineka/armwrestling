import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { sessions } from "@/db/schema";
import type { JournalDb } from "@/db/types";

export const SESSION_DAYS = 30;

// Формат хешу: scrypt:<сіль hex>:<хеш hex>. Його друкує scripts/hash-password.mjs.
export async function verifyPassword(password: string, stored: string) {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  // timingSafeEqual порівнює за однаковий час, щоб за швидкістю відповіді
  // не можна було вгадати, скільки байтів збіглося.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(db: JournalDb, now = new Date()) {
  await db.delete(sessions).where(lte(sessions.expiresAt, now));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function isValidSession(db: JournalDb, token: string, now = new Date()) {
  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  return Boolean(row);
}

export async function deleteSession(db: JournalDb, token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function scryptAsync(password: string, salt: Buffer, length: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, (error, key) => (error ? reject(error) : resolve(key)));
  });
}
