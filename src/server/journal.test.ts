import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EQUIPMENT } from "./catalog";
import { addSet, getJournal, seedHandles } from "./journal";
import { createTestDb } from "./test-db";

describe("журнал підходів", () => {
  it("зберігає підхід і рахує рекорд як найбільшу вагу на вправу, ручку і руку", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "thin-handle");

    await addSet(db, {
      handleId,
      exercise: "pronation",
      arm: "right",
      weightKg: 20,
      reps: 5,
      elbowPain: 0,
      blockHeight: "highest",
      band: "red",
      trainedOn: "2026-10-14",
    });
    await addSet(db, {
      handleId,
      exercise: "pronation",
      arm: "right",
      weightKg: 15,
      reps: 8,
      blockHeight: "highest",
      trainedOn: "2026-10-14",
    });
    await addSet(db, {
      handleId,
      exercise: "pronation",
      arm: "left",
      weightKg: 18,
      reps: 3,
      blockHeight: "lowest",
      trainedOn: "2026-10-14",
    });

    const journal = await getJournal(db, "2026-10-14");
    const right = journal.records.find(
      (record) => record.handleId === handleId && record.arm === "right",
    );
    const left = journal.records.find(
      (record) => record.handleId === handleId && record.arm === "left",
    );

    assert.equal(right?.weightKg, 20);
    assert.equal(left?.weightKg, 18);
    assert.equal(journal.sets.length, 3);
    assert.equal(journal.sets[0]?.weightKg, 18);
    assert.equal(journal.sets[2]?.band, "red");
    assert.equal(journal.sets[2]?.blockHeight, "highest");
  });

  it("піднімає рекорд, коли вага з десятими більша", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "cup");

    await addSet(db, {
      handleId,
      exercise: "cupping",
      arm: "right",
      weightKg: 22.5,
      reps: 3,
      blockHeight: "above_mid",
      trainedOn: "2026-10-14",
    });

    const journal = await getJournal(db, "2026-10-14");
    assert.equal(journal.records[0]?.weightKg, 22.5);
    assert.equal(journal.sets[0]?.elbowPain, 0);
    assert.equal(journal.sets[0]?.band, null);
  });

  it("відхиляє нульову вагу, нульові повтори, чужу ручку і неіснуючу дату", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "rise");
    const valid = {
      handleId,
      exercise: "rising",
      arm: "right" as const,
      weightKg: 10,
      reps: 5,
      blockHeight: "below_mid" as const,
      trainedOn: "2026-10-14",
    };

    await assert.rejects(addSet(db, { ...valid, weightKg: 0 }), /bad_weight/);
    await assert.rejects(addSet(db, { ...valid, reps: 0 }), /bad_reps/);
    await assert.rejects(addSet(db, { ...valid, handleId: "немає-такої" }), /bad_handle/);
    await assert.rejects(addSet(db, { ...valid, trainedOn: "2026-02-31" }), /bad_date/);
    await assert.rejects(addSet(db, { ...valid, blockHeight: "middle" }), /bad_block/);
  });

  it("для ізометрії зберігає секунди і не просить повтори", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "belt");

    const created = await addSet(db, {
      handleId,
      exercise: "table_isometric_holds",
      arm: "right",
      weightKg: 25,
      holdSeconds: 12,
      blockHeight: "lowest",
      trainedOn: "2026-10-14",
    });

    assert.equal(created.holdSeconds, 12);
    assert.equal(created.reps, 0);

    await assert.rejects(
      addSet(db, {
        handleId,
        exercise: "table_isometric_holds",
        arm: "right",
        weightKg: 25,
        blockHeight: "lowest",
        trainedOn: "2026-10-14",
      }),
      /bad_hold/,
    );
  });

  it("показує вправу пропущеною, якщо за останні 7 днів її не було", async () => {
    const db = await createTestDb();
    await seedHandles(db);

    await addSet(db, {
      handleId: "thin-handle",
      exercise: "pronation",
      arm: "right",
      weightKg: 12,
      reps: 6,
      blockHeight: "highest",
      trainedOn: "2026-10-08",
    });
    await addSet(db, {
      handleId: "thin-handle",
      exercise: "cupping",
      arm: "right",
      weightKg: 12,
      reps: 6,
      blockHeight: "highest",
      trainedOn: "2026-10-07",
    });

    const journal = await getJournal(db, "2026-10-14");

    assert.equal(journal.missingExercises.includes("pronation"), false);
    assert.equal(journal.missingExercises.includes("cupping"), true);
    assert.equal(journal.missingExercises.includes("back_pressure"), true);
  });

  it("не дублює стартові ручки, якщо вони вже є", async () => {
    const db = await createTestDb();
    await seedHandles(db);
    await seedHandles(db);
    const journal = await getJournal(db, "2026-10-14");
    assert.equal(journal.handles.length, EQUIPMENT.length);
  });
});

async function seedOne(db: Awaited<ReturnType<typeof createTestDb>>, vector: string) {
  const { handles } = await import("@/db/schema");
  const id = crypto.randomUUID();
  await db.insert(handles).values({ id, name: vector, vector });
  return id;
}
