import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { handles, sets } from "@/db/schema";
import type { JournalDb } from "@/db/types";
import {
  BANDS,
  BLOCK_HEIGHTS,
  EQUIPMENT,
  EXERCISE_IDS,
  ISOMETRIC_EXERCISE,
  type BandId,
  type EquipmentId,
} from "./catalog";

export class JournalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JournalError";
  }
}

function asEnum<T extends string>(values: readonly T[]): [T, ...T[]] {
  return values as unknown as [T, ...T[]];
}

// Приймаємо лише посилання на наше сховище Vercel Blob, а не будь-який сайт.
const videoUrl = z
  .string({ invalid_type_error: "bad_video" })
  .url("bad_video")
  .refine(isBlobUrl, "bad_video");

const setInput = z
  .object({
    handleId: z.string().min(1, "bad_handle"),
    exercise: z.enum(asEnum(EXERCISE_IDS), { message: "bad_exercise" }),
    arm: z.enum(["left", "right"], { message: "bad_arm" }),
    weightKg: z
      .number({ invalid_type_error: "bad_weight" })
      .positive("bad_weight")
      .max(500, "bad_weight"),
    reps: z
      .number({ invalid_type_error: "bad_reps" })
      .int("bad_reps")
      .min(0, "bad_reps")
      .max(100, "bad_reps")
      .optional(),
    holdSeconds: z
      .number({ invalid_type_error: "bad_hold" })
      .int("bad_hold")
      .positive("bad_hold")
      .max(600, "bad_hold")
      .nullable()
      .optional(),
    setCount: z
      .number({ invalid_type_error: "bad_sets" })
      .int("bad_sets")
      .min(1, "bad_sets")
      .max(20, "bad_sets")
      .optional()
      .default(1),
    blockHeight: z.enum(asEnum(BLOCK_HEIGHTS), { message: "bad_block" }),
    band: z.enum(asEnum(BANDS), { message: "bad_band" }).nullable().optional(),
    trainedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "bad_date"),
    videoUrl: videoUrl.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.exercise === ISOMETRIC_EXERCISE) {
      if (data.holdSeconds == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "bad_hold",
          path: ["holdSeconds"],
        });
      }
      return;
    }
    if (data.reps == null || data.reps < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bad_reps",
        path: ["reps"],
      });
    }
  });

const videoInput = z.object({ videoUrl });

export type Arm = "left" | "right";

export type HandleView = {
  id: string;
  name: string;
  image: string | null;
};

export type SetView = {
  id: string;
  handleId: string;
  handleName: string;
  image: string | null;
  exercise: string;
  arm: Arm;
  weightKg: number;
  reps: number;
  holdSeconds: number | null;
  setCount: number;
  blockHeight: string;
  band: string | null;
  trainedOn: string;
  videoUrl: string | null;
};

// Одна картка у вкладці «Мої рекорди»: найкраща спроба і всі інші для тієї ж
// вправи, ручки і руки.
export type RecordView = {
  key: string;
  handleId: string;
  handleName: string;
  image: string | null;
  exercise: string;
  arm: Arm;
  best: SetView;
  history: SetView[];
};

export type JournalView = {
  handles: HandleView[];
  records: RecordView[];
};

export async function seedHandles(db: JournalDb) {
  const existing = await db.select({ id: handles.id }).from(handles);
  const known = new Set<string>(EQUIPMENT.map((item) => item.id));
  const legacy = existing.filter((row) => !known.has(row.id));

  if (legacy.length > 0) {
    const logged = await db.select({ id: sets.id }).from(sets).limit(1);
    if (logged.length === 0) {
      await db.delete(handles);
    }
  }

  const current = await db.select({ id: handles.id }).from(handles);
  const have = new Set(current.map((row) => row.id));
  const missing = EQUIPMENT.filter((item) => !have.has(item.id));
  if (missing.length === 0) return;

  await db.insert(handles).values(
    missing.map((item) => ({
      id: item.id,
      name: item.id,
      vector: "equipment",
      image: item.image,
    })),
  );
}

export async function addSet(db: JournalDb, input: unknown): Promise<SetView> {
  const parsed = setInput.safeParse(input);
  if (!parsed.success) {
    throw new JournalError(parsed.error.issues[0]?.message ?? "invalid");
  }

  assertRealDate(parsed.data.trainedOn);

  const [handle] = await db
    .select()
    .from(handles)
    .where(eq(handles.id, parsed.data.handleId))
    .limit(1);

  if (!handle) {
    throw new JournalError("bad_handle");
  }

  const isometric = parsed.data.exercise === ISOMETRIC_EXERCISE;
  const row = {
    id: crypto.randomUUID(),
    handleId: handle.id,
    arm: parsed.data.arm,
    weightGrams: Math.round(parsed.data.weightKg * 1000),
    reps: isometric ? 0 : (parsed.data.reps ?? 0),
    setCount: parsed.data.setCount,
    trainedOn: parsed.data.trainedOn,
    exercise: parsed.data.exercise,
    blockHeight: parsed.data.blockHeight,
    band: (parsed.data.band ?? null) as BandId | null,
    holdSeconds: isometric ? (parsed.data.holdSeconds ?? null) : null,
    videoUrl: parsed.data.videoUrl ?? null,
  };

  await db.insert(sets).values({ ...row, createdAt: new Date() });

  return toSetView(row, handle);
}

export async function attachVideo(
  db: JournalDb,
  id: string,
  input: unknown,
): Promise<void> {
  const parsed = videoInput.safeParse(input);
  if (!parsed.success) {
    throw new JournalError(parsed.error.issues[0]?.message ?? "invalid");
  }

  const [existing] = await db
    .select({ id: sets.id })
    .from(sets)
    .where(eq(sets.id, id))
    .limit(1);

  if (!existing) {
    throw new JournalError("not_found");
  }

  await db
    .update(sets)
    .set({ videoUrl: parsed.data.videoUrl })
    .where(eq(sets.id, id));
}

export async function getJournal(db: JournalDb): Promise<JournalView> {
  const handleRows = await db.select().from(handles);
  const handleById = new Map(handleRows.map((handle) => [handle.id, handle]));
  const equipmentOrder = new Map<string, number>(
    EQUIPMENT.map((item, index) => [item.id, index]),
  );
  const exerciseOrder = new Map<string, number>(
    EXERCISE_IDS.map((exercise, index) => [exercise, index]),
  );

  // База сортує від найкращої спроби: важча вага, потім більше повторів або
  // довше утримання. Тому перша спроба в кожній групі і є рекордом.
  const setRows = await db
    .select()
    .from(sets)
    .orderBy(
      desc(sets.weightGrams),
      desc(sets.reps),
      desc(sets.holdSeconds),
      desc(sets.trainedOn),
    );

  const groups = new Map<string, RecordView>();
  for (const row of setRows) {
    const handle = handleById.get(row.handleId);
    if (!handle || !row.exercise || (row.arm !== "left" && row.arm !== "right")) {
      continue;
    }
    const view = toSetView(row, handle);
    const key = `${row.exercise}:${row.handleId}:${row.arm}`;
    const group = groups.get(key);
    if (group) {
      group.history.push(view);
    } else {
      groups.set(key, {
        key,
        handleId: row.handleId,
        handleName: handle.name,
        image: handle.image,
        exercise: row.exercise,
        arm: row.arm,
        best: view,
        history: [],
      });
    }
  }

  const records = [...groups.values()];
  for (const record of records) {
    record.history.sort((a, b) => b.trainedOn.localeCompare(a.trainedOn));
  }
  records.sort(
    (a, b) =>
      (exerciseOrder.get(a.exercise) ?? 99) - (exerciseOrder.get(b.exercise) ?? 99) ||
      (equipmentOrder.get(a.handleId) ?? 99) - (equipmentOrder.get(b.handleId) ?? 99) ||
      (a.arm === b.arm ? 0 : a.arm === "right" ? -1 : 1),
  );

  return {
    handles: handleRows
      .filter((handle) => Boolean(handle.image))
      .map((handle) => ({
        id: handle.id,
        name: handle.name,
        image: handle.image,
      }))
      .sort(
        (a, b) =>
          (equipmentOrder.get(a.id as EquipmentId) ?? 99) -
          (equipmentOrder.get(b.id as EquipmentId) ?? 99),
      ),
    records,
  };
}

type HandleRow = {
  id: string;
  name: string;
  image: string | null;
};

type SetRow = {
  id: string;
  handleId: string;
  arm: string;
  weightGrams: number;
  reps: number;
  setCount: number;
  trainedOn: string;
  exercise: string | null;
  blockHeight: string | null;
  band: string | null;
  holdSeconds: number | null;
  videoUrl: string | null;
};

function toSetView(row: SetRow, handle: HandleRow): SetView {
  return {
    id: row.id,
    handleId: row.handleId,
    handleName: handle.name,
    image: handle.image,
    exercise: row.exercise ?? "",
    arm: row.arm as Arm,
    weightKg: row.weightGrams / 1000,
    reps: row.reps,
    holdSeconds: row.holdSeconds,
    setCount: row.setCount,
    blockHeight: row.blockHeight ?? "",
    band: row.band,
    trainedOn: row.trainedOn,
    videoUrl: row.videoUrl,
  };
}

function isBlobUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function assertRealDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!real) {
    throw new JournalError("bad_date");
  }
}
