import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { describe, it } from "node:test";
import {
  clearFailedLogins,
  createSession,
  deleteSession,
  isValidSession,
  LOGIN_WINDOW_MINUTES,
  loginRetryAfter,
  MAX_FAILED_LOGINS,
  recordFailedLogin,
  SESSION_DAYS,
  verifyPassword,
} from "./auth";
import { createTestDb } from "./test-db";

function hashFor(password: string) {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

describe("вхід власника", () => {
  it("приймає правильний пароль і відхиляє неправильний", async () => {
    const stored = hashFor("міцна-рука-2026");

    assert.equal(await verifyPassword("міцна-рука-2026", stored), true);
    assert.equal(await verifyPassword("міцна-рука-2025", stored), false);
    assert.equal(await verifyPassword("", stored), false);
  });

  it("не пускає з пошкодженим або чужим форматом хешу", async () => {
    assert.equal(await verifyPassword("будь-що", "просто-пароль"), false);
    assert.equal(await verifyPassword("будь-що", "bcrypt:aa:bb"), false);
    assert.equal(await verifyPassword("будь-що", "scrypt::"), false);
  });

  it("сесія діє після входу і зникає після виходу", async () => {
    const db = await createTestDb();
    const { token } = await createSession(db);

    assert.equal(await isValidSession(db, token), true);
    assert.equal(await isValidSession(db, "вигаданий-токен"), false);

    await deleteSession(db, token);
    assert.equal(await isValidSession(db, token), false);
  });

  it("прострочена сесія не діє і прибирається при наступному вході", async () => {
    const db = await createTestDb();
    const longAgo = new Date("2026-01-01T00:00:00Z");
    const { token: old } = await createSession(db, longAgo);

    const afterExpiry = new Date(longAgo.getTime() + (SESSION_DAYS + 1) * 24 * 60 * 60 * 1000);
    assert.equal(await isValidSession(db, old, afterExpiry), false);

    const { sessions } = await import("@/db/schema");
    await createSession(db, afterExpiry);
    const rows = await db.select().from(sessions);
    assert.equal(rows.length, 1);
  });

  it("зберігає в базі хеш токена, а не сам токен", async () => {
    const db = await createTestDb();
    const { token } = await createSession(db);
    const { sessions } = await import("@/db/schema");
    const [row] = await db.select().from(sessions);

    assert.notEqual(row?.id, token);
    assert.equal(row?.id.length, 64);
  });
});

describe("ліміт спроб входу", () => {
  const minutes = (n: number) => n * 60 * 1000;

  it("блокує IP після 5 невдалих спроб і відпускає через 15 хвилин", async () => {
    const db = await createTestDb();
    const start = new Date("2026-11-09T12:00:00Z");

    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) {
      await recordFailedLogin(db, "1.2.3.4", new Date(start.getTime() + minutes(i)));
    }
    assert.equal(await loginRetryAfter(db, "1.2.3.4", new Date(start.getTime() + minutes(4))), null);

    await recordFailedLogin(db, "1.2.3.4", new Date(start.getTime() + minutes(4)));
    // Найстаріша спроба о 12:00 звільнить місце о 12:15, тобто через 11 хвилин після 12:04.
    assert.equal(
      await loginRetryAfter(db, "1.2.3.4", new Date(start.getTime() + minutes(4))),
      11 * 60,
    );

    const afterWindow = new Date(start.getTime() + minutes(LOGIN_WINDOW_MINUTES) + 1);
    assert.equal(await loginRetryAfter(db, "1.2.3.4", afterWindow), null);
  });

  it("рахує кожну IP окремо і скидає лічильник після вдалого входу", async () => {
    const db = await createTestDb();
    const now = new Date("2026-11-09T12:00:00Z");

    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await recordFailedLogin(db, "1.2.3.4", now);
    }
    assert.notEqual(await loginRetryAfter(db, "1.2.3.4", now), null);
    assert.equal(await loginRetryAfter(db, "5.6.7.8", now), null);

    await clearFailedLogins(db, "1.2.3.4");
    assert.equal(await loginRetryAfter(db, "1.2.3.4", now), null);
  });
});
