import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EQUIPMENT } from "./catalog";
import { addSet, attachVideo, checkRecord, deleteSet, getJournal, seedHandles, updateSet } from "./journal";
import { createTestDb } from "./test-db";

const BLOB_VIDEO = "https://abc123.public.blob.vercel-storage.com/records/video-x1y2.mp4";

describe("журнал рекордів", () => {
  it("показує найкращу спробу як рекорд, а решту як історію для вправи, ручки і руки", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "thin-handle");

    await addSet(db, {
      handleId,
      exercise: "pronation",
      arm: "right",
      weightKg: 20,
      reps: 5,
      setCount: 3,
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
      trainedOn: "2026-10-20",
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

    const journal = await getJournal(db);
    const right = journal.records[0]?.right;
    const left = journal.records[0]?.left;

    // Обидві руки в одній картці вправа + ручка.
    assert.equal(journal.records.length, 1);
    assert.equal(right?.best.weightKg, 20);
    assert.equal(right?.best.setCount, 3);
    assert.equal(right?.best.band, "red");
    assert.equal(right?.history.length, 1);
    assert.equal(right?.history[0]?.weightKg, 15);
    assert.equal(left?.best.weightKg, 18);
    assert.equal(left?.history.length, 0);
  });

  it("при однаковій вазі рекордом стає спроба з більшою кількістю повторів", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "cup");
    const base = {
      handleId,
      exercise: "cupping",
      arm: "right" as const,
      weightKg: 22.5,
      blockHeight: "above_mid" as const,
      trainedOn: "2026-10-14",
    };

    await addSet(db, { ...base, reps: 3 });
    await addSet(db, { ...base, reps: 6 });

    const journal = await getJournal(db);
    assert.equal(journal.records[0]?.right?.best.weightKg, 22.5);
    assert.equal(journal.records[0]?.right?.best.reps, 6);
    assert.equal(journal.records[0]?.right?.best.setCount, 1);
    assert.equal(journal.records[0]?.right?.best.videoUrl, null);
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
    await assert.rejects(addSet(db, { ...valid, setCount: 0 }), /bad_sets/);
    await assert.rejects(addSet(db, { ...valid, setCount: 2.5 }), /bad_sets/);
    await assert.rejects(addSet(db, { ...valid, handleId: "немає-такої" }), /bad_handle/);
    await assert.rejects(addSet(db, { ...valid, trainedOn: "2026-02-31" }), /bad_date/);
    await assert.rejects(addSet(db, { ...valid, blockHeight: "middle" }), /bad_block/);
  });

  it("зберігає вагу тіла і віддає останню записану для підказки у формі", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "body");
    const base = {
      handleId,
      exercise: "pronation",
      arm: "right" as const,
      weightKg: 50,
      reps: 3,
      trainedOn: "2026-11-01",
    };

    assert.equal((await getJournal(db)).lastBodyWeightKg, null);

    const created = await addSet(db, { ...base, bodyWeightKg: 92.4 });
    await addSet(db, { ...base, trainedOn: "2026-11-05", bodyWeightKg: 93.1 });
    await addSet(db, { ...base, trainedOn: "2026-11-09" });

    assert.equal(created.bodyWeightKg, 92.4);
    assert.equal((await getJournal(db)).lastBodyWeightKg, 93.1);

    await assert.rejects(addSet(db, { ...base, bodyWeightKg: 5 }), /bad_body_weight/);
    await assert.rejects(addSet(db, { ...base, bodyWeightKg: "93" }), /bad_body_weight/);
  });

  it("визначає перший запис, новий рекорд і звичайну спробу", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "pr");
    const base = {
      handleId,
      exercise: "pronation",
      arm: "right" as const,
      reps: 3,
      trainedOn: "2026-11-09",
    };

    const first = await addSet(db, { ...base, weightKg: 50 });
    assert.deepEqual(await checkRecord(db, first), { kind: "first", previousBestKg: null });

    const heavier = await addSet(db, { ...base, weightKg: 52.5 });
    assert.deepEqual(await checkRecord(db, heavier), { kind: "record", previousBestKg: 50 });

    const lighter = await addSet(db, { ...base, weightKg: 45 });
    assert.equal((await checkRecord(db, lighter)).kind, "none");

    // Та сама вага, але більше повторів: теж рекорд.
    const moreReps = await addSet(db, { ...base, weightKg: 52.5, reps: 5 });
    assert.equal((await checkRecord(db, moreReps)).kind, "record");

    // Інша рука рахується окремо.
    const left = await addSet(db, { ...base, arm: "left", weightKg: 20 });
    assert.equal((await checkRecord(db, left)).kind, "first");
  });

  it("записує рекорд без блока, наприклад з поясом без стола", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "belt-only");

    const created = await addSet(db, {
      handleId,
      exercise: "rising",
      arm: "right",
      weightKg: 40,
      reps: 1,
      trainedOn: "2026-11-09",
    });
    await addSet(db, {
      handleId,
      exercise: "rising",
      arm: "right",
      weightKg: 35,
      reps: 1,
      blockHeight: null,
      trainedOn: "2026-11-09",
    });

    assert.equal(created.blockHeight, "");
    const journal = await getJournal(db);
    assert.equal(journal.records[0]?.right?.best.weightKg, 40);
    assert.equal(journal.records[0]?.right?.history.length, 1);
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

  it("зберігає відео з Vercel Blob і не приймає посилання на інші сайти", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "video");
    const valid = {
      handleId,
      exercise: "pronation",
      arm: "right" as const,
      weightKg: 30,
      reps: 2,
      blockHeight: "highest" as const,
      trainedOn: "2026-10-14",
    };

    const created = await addSet(db, { ...valid, videoUrl: BLOB_VIDEO });
    assert.equal(created.videoUrl, BLOB_VIDEO);

    await assert.rejects(
      addSet(db, { ...valid, videoUrl: "https://evil.example.com/video.mp4" }),
      /bad_video/,
    );
    await assert.rejects(addSet(db, { ...valid, videoUrl: "не посилання" }), /bad_video/);
  });

  it("прикріплює відео до вже записаного рекорду", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "attach");

    const created = await addSet(db, {
      handleId,
      exercise: "supination",
      arm: "left",
      weightKg: 14,
      reps: 4,
      blockHeight: "lowest",
      trainedOn: "2026-10-14",
    });

    await attachVideo(db, created.id, { videoUrl: BLOB_VIDEO });
    const journal = await getJournal(db);
    assert.equal(journal.records[0]?.left?.best.videoUrl, BLOB_VIDEO);

    await assert.rejects(
      attachVideo(db, "немає-такого", { videoUrl: BLOB_VIDEO }),
      /not_found/,
    );
    await assert.rejects(
      attachVideo(db, created.id, { videoUrl: "https://evil.example.com/v.mp4" }),
      /bad_video/,
    );
  });

  it("редагує запис, перераховує рекорд і повертає старе відео", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "edit");
    const base = {
      handleId,
      exercise: "cupping",
      arm: "right" as const,
      reps: 5,
      blockHeight: "highest" as const,
      trainedOn: "2026-10-16",
    };

    const typo = await addSet(db, { ...base, weightKg: 500, videoUrl: BLOB_VIDEO });
    await addSet(db, { ...base, weightKg: 57.5 });

    const newVideo = BLOB_VIDEO.replace("x1y2", "z9");
    const { set, previousVideoUrl } = await updateSet(db, typo.id, {
      ...base,
      weightKg: 50,
      videoUrl: newVideo,
    });

    assert.equal(set.weightKg, 50);
    assert.equal(previousVideoUrl, BLOB_VIDEO);
    const journal = await getJournal(db);
    assert.equal(journal.records[0]?.right?.best.weightKg, 57.5);
    assert.equal(journal.records[0]?.right?.history[0]?.videoUrl, newVideo);

    await assert.rejects(updateSet(db, typo.id, { ...base, weightKg: 0 }), /bad_weight/);
    await assert.rejects(updateSet(db, "немає-такого", { ...base, weightKg: 10 }), /not_found/);
  });

  it("видаляє запис і повертає його відео, щоб прибрати файл зі сховища", async () => {
    const db = await createTestDb();
    const handleId = await seedOne(db, "delete");
    const created = await addSet(db, {
      handleId,
      exercise: "cupping",
      arm: "right",
      weightKg: 500,
      reps: 80,
      blockHeight: "highest",
      trainedOn: "2026-10-16",
      videoUrl: BLOB_VIDEO,
    });

    const { videoUrl } = await deleteSet(db, created.id);
    assert.equal(videoUrl, BLOB_VIDEO);
    assert.equal((await getJournal(db)).records.length, 0);

    await assert.rejects(deleteSet(db, created.id), /not_found/);
  });

  it("не дублює стартові ручки, якщо вони вже є", async () => {
    const db = await createTestDb();
    await seedHandles(db);
    await seedHandles(db);
    const journal = await getJournal(db);
    assert.equal(journal.handles.length, EQUIPMENT.length);
  });
});

async function seedOne(db: Awaited<ReturnType<typeof createTestDb>>, vector: string) {
  const { handles } = await import("@/db/schema");
  const id = crypto.randomUUID();
  await db.insert(handles).values({ id, name: vector, vector });
  return id;
}
