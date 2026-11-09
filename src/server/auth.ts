import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt, lte } from "drizzle-orm";
import { loginAttempts, sessions } from "@/db/schema";
import type { JournalDb } from "@/db/types";

export const SESSION_DAYS = 30;
export const MAX_FAILED_LOGINS = 5;
export const LOGIN_WINDOW_MINUTES = 15;

const LOGIN_WINDOW_MS = LOGIN_WINDOW_MINUTES * 60 * 1000;

// Скільки секунд чекати до наступної спроби, або null, якщо входити можна.
// Блок знімається, коли найстаріша з останніх невдалих спроб виходить за вікно 15 хвилин.
export async function loginRetryAfter(db: JournalDb, ip: string, now = new Date()) {
  const windowStart = new Date(now.getTime() - LOGIN_WINDOW_MS);
  await db.delete(loginAttempts).where(lte(loginAttempts.attemptedAt, windowStart));

  const recent = await db
    .select({ attemptedAt: loginAttempts.attemptedAt })
    .from(loginAttempts)
    .where(eq(loginAttempts.ip, ip))
    .orderBy(asc(loginAttempts.attemptedAt));

  if (recent.length < MAX_FAILED_LOGINS) return null;

  const oldest = new Date(recent[recent.length - MAX_FAILED_LOGINS]!.attemptedAt);
  return Math.max(1, Math.ceil((oldest.getTime() + LOGIN_WINDOW_MS - now.getTime()) / 1000));
}

export async function recordFailedLogin(db: JournalDb, ip: string, now = new Date()) {
  await db.insert(loginAttempts).values({ id: randomBytes(16).toString("hex"), ip, attemptedAt: now });
}

export async function clearFailedLogins(db: JournalDb, ip: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}

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
