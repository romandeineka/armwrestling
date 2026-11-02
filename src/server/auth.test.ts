import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { describe, it } from "node:test";
import { createSession, deleteSession, isValidSession, SESSION_DAYS, verifyPassword } from "./auth";
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
