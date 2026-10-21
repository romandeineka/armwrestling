import { desc, eq, gte, max } from "drizzle-orm";
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
  type ExerciseId,
  windowStart,
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
};

export type RecordView = {
  handleId: string;
  handleName: string;
  exercise: string;
  arm: Arm;
  weightKg: number;
};

export type JournalView = {
  handles: HandleView[];
  sets: SetView[];
  records: RecordView[];
  missingExercises: ExerciseId[];
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
  const id = crypto.randomUUID();
  const weightGrams = Math.round(parsed.data.weightKg * 1000);
  const reps = isometric ? 0 : (parsed.data.reps ?? 0);
  const holdSeconds = isometric ? (parsed.data.holdSeconds ?? null) : null;
  const band = (parsed.data.band ?? null) as BandId | null;

  await db.insert(sets).values({
    id,
    handleId: handle.id,
    arm: parsed.data.arm,
    weightGrams,
    reps,
    setCount: parsed.data.setCount,
    trainedOn: parsed.data.trainedOn,
    createdAt: new Date(),
    exercise: parsed.data.exercise,
    blockHeight: parsed.data.blockHeight,
    band,
    holdSeconds,
  });

  return toSetView(
    {
      id,
      handleId: handle.id,
      arm: parsed.data.arm,
      weightGrams,
      reps,
      setCount: parsed.data.setCount,
      trainedOn: parsed.data.trainedOn,
      exercise: parsed.data.exercise,
      blockHeight: parsed.data.blockHeight,
      band,
      holdSeconds,
    },
    handle,
  );
}

export async function getJournal(db: JournalDb, today: string): Promise<JournalView> {
  const handleRows = await db.select().from(handles);
  const handleById = new Map(handleRows.map((handle) => [handle.id, handle]));
  const equipmentOrder = new Map(EQUIPMENT.map((item, index) => [item.id, index]));
  const exerciseOrder = new Map(EXERCISE_IDS.map((exercise, index) => [exercise, index]));

  const setRows = await db.select().from(sets).orderBy(desc(sets.createdAt)).limit(40);

  const recordRows = await db
    .select({
      handleId: sets.handleId,
      exercise: sets.exercise,
      arm: sets.arm,
      weightGrams: max(sets.weightGrams),
    })
    .from(sets)
    .groupBy(sets.handleId, sets.exercise, sets.arm);

  const start = windowStart(today);
  const weekRows = await db
    .select({ exercise: sets.exercise })
    .from(sets)
    .where(gte(sets.trainedOn, start));

  const covered = new Set(
    weekRows
      .map((row) => row.exercise)
      .filter((exercise): exercise is string => Boolean(exercise)),
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
        (a, b) => (equipmentOrder.get(a.id as EquipmentId) ?? 99) - (equipmentOrder.get(b.id as EquipmentId) ?? 99),
      ),
    sets: setRows.flatMap((row) => {
      const handle = handleById.get(row.handleId);
      if (!handle || (row.arm !== "left" && row.arm !== "right")) return [];
      return [toSetView(row, handle)];
    }),
    records: recordRows
      .flatMap((row) => {
        const handle = handleById.get(row.handleId);
        const arm = row.arm === "left" || row.arm === "right" ? row.arm : null;
        if (!handle || row.weightGrams == null || !row.exercise || !arm) {
          return [];
        }
        return [
          {
            handleId: row.handleId,
            handleName: handle.name,
            exercise: row.exercise,
            arm: arm as Arm,
            weightKg: Number(row.weightGrams) / 1000,
          },
        ];
      })
      .sort(
        (a, b) =>
          (exerciseOrder.get(a.exercise as ExerciseId) ?? 99) -
          (exerciseOrder.get(b.exercise as ExerciseId) ?? 99),
      ),
    missingExercises: EXERCISE_IDS.filter((exercise) => !covered.has(exercise)),
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
  };
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
