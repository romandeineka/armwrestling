"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/use-locale";
import type { Messages } from "@/i18n/messages";
import {
  BANDS,
  BLOCK_HEIGHTS,
  ISOMETRIC_EXERCISE,
  kyivToday,
  type BandId,
  type BlockHeight,
  type ExerciseId,
} from "@/server/catalog";
import type { Arm, JournalView } from "@/server/journal";

const emptyJournal: JournalView = {
  handles: [],
  sets: [],
  records: [],
  missingExercises: [],
};

const BAND_SWATCH: Record<BandId, string> = {
  green_heavy: "bg-[#1f7a3a]",
  purple: "bg-[#7a3ea1]",
  green_light: "bg-[#8fbf45]",
  red: "bg-[#d24b4b]",
};

export function JournalBoard() {
  const { locale, setLocale, t } = useLocale();
  const [journal, setJournal] = useState<JournalView>(emptyJournal);
  const [handleId, setHandleId] = useState("");
  const [exercise, setExercise] = useState<ExerciseId>("pronation");
  const [arm, setArm] = useState<Arm>("right");
  const [weightKg, setWeightKg] = useState("");
  const [reps, setReps] = useState("");
  const [holdSeconds, setHoldSeconds] = useState("");
  const [elbowPain, setElbowPain] = useState("0");
  const [blockHeight, setBlockHeight] = useState<BlockHeight | "">("");
  const [band, setBand] = useState<BandId | "">("");
  const [trainedOn, setTrainedOn] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const isometric = exercise === ISOMETRIC_EXERCISE;

  async function load() {
    const response = await fetch("/api/journal");
    if (!response.ok) {
      setError(t.loadFailed);
      return;
    }
    const data = (await response.json()) as JournalView;
    setJournal(data);
    setHandleId((current) => current || data.handles[0]?.id || "");
    setReady(true);
  }

  useEffect(() => {
    setTrainedOn(kyivToday());
    void load();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!blockHeight) {
      setError(t.errors.bad_block);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handleId,
          exercise,
          arm,
          weightKg: Number(weightKg.replace(",", ".")),
          reps: isometric ? undefined : Number(reps),
          holdSeconds: isometric ? Number(holdSeconds) : null,
          elbowPain: Number(elbowPain),
          blockHeight,
          band: band || null,
          trainedOn,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        const code = data.error ?? "save_failed";
        setError(t.errors[code as keyof Messages["errors"]] ?? t.errors.save_failed);
        return;
      }
      setWeightKg("");
      setReps("");
      setHoldSeconds("");
      setElbowPain("0");
      await load();
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10">
      <header className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs tracking-[0.28em] text-muted uppercase">{t.kicker}</p>
            <div className="flex rounded-full border border-line bg-card p-1" aria-label={t.language}>
              <LangButton current={locale} value="uk" label="UA" onPick={setLocale} />
              <LangButton current={locale} value="en" label="EN" onPick={setLocale} />
            </div>
          </div>
          <h1 className="font-display text-5xl tracking-tight text-foreground uppercase">{t.title}</h1>
          <p className="max-w-xl text-muted">{t.intro}</p>
        </div>
        <figure className="overflow-hidden rounded-2xl border border-line shadow-lg">
          <img src="/media/table-side.jpg" alt={t.tableAlt} className="h-44 w-full object-cover" />
        </figure>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-2xl border border-line bg-card/95 p-5">
        <h2 className="font-display text-2xl uppercase">{t.newSet}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t.date}
            <input
              type="date"
              value={trainedOn}
              onChange={(event) => setTrainedOn(event.target.value)}
              className="rounded-lg border border-line bg-background px-3 py-2 text-foreground"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t.exercise}
            <select
              value={exercise}
              onChange={(event) => setExercise(event.target.value as ExerciseId)}
              className="rounded-lg border border-line bg-background px-3 py-2 text-foreground"
            >
              {(Object.keys(t.exercises) as ExerciseId[]).map((id) => (
                <option key={id} value={id}>
                  {t.exercises[id]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-muted">{t.handle}</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
            {journal.handles.map((handle) => {
              const active = handle.id === handleId;
              const label = equipmentLabel(t, handle.id, handle.name);
              return (
                <button
                  key={handle.id}
                  type="button"
                  onClick={() => setHandleId(handle.id)}
                  className={`overflow-hidden rounded-xl border text-left ${
                    active ? "border-accent ring-1 ring-accent" : "border-line"
                  }`}
                >
                  {handle.image ? (
                    <img src={handle.image} alt="" className="h-16 w-full object-cover" />
                  ) : null}
                  <span className="block px-1.5 py-1 text-center text-[11px] leading-tight text-foreground">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex gap-2">
          <ArmButton current={arm} value="right" onPick={setArm} label={t.right} />
          <ArmButton current={arm} value="left" onPick={setArm} label={t.left} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-muted">{t.block}</legend>
            <p className="text-xs text-muted">{t.blockHint}</p>
            <div className="flex gap-3">
              <img
                src="/media/pulley-block.jpg"
                alt={t.pulleyAlt}
                className="h-36 w-20 rounded-lg object-cover object-top"
              />
              <div className="flex flex-1 flex-col gap-1">
                {BLOCK_HEIGHTS.map((height) => (
                  <ChoiceButton
                    key={height}
                    active={blockHeight === height}
                    label={t.heights[height]}
                    onPick={() => setBlockHeight(height)}
                  />
                ))}
              </div>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-muted">{t.band}</legend>
            <p className="text-xs text-muted">{t.bandHint}</p>
            <img src="/media/resistance-bands.jpg" alt={t.bandsAlt} className="h-28 w-full rounded-lg object-cover" />
            <div className="grid grid-cols-2 gap-1">
              <ChoiceButton active={band === ""} label={t.bandNone} onPick={() => setBand("")} />
              {BANDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBand(id)}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-sm ${
                    band === id
                      ? "border-accent bg-accent text-background"
                      : "border-line bg-background text-foreground"
                  }`}
                >
                  <span className={`h-3 w-3 rounded-full ${BAND_SWATCH[id]}`} />
                  {t.bands[id]}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <NumberField label={t.kg} value={weightKg} onChange={setWeightKg} step="0.5" />
          {isometric ? (
            <NumberField label={t.seconds} value={holdSeconds} onChange={setHoldSeconds} step="1" min="1" max="600" />
          ) : (
            <NumberField label={t.reps} value={reps} onChange={setReps} step="1" min="1" />
          )}
          <NumberField label={t.elbow} value={elbowPain} onChange={setElbowPain} step="1" min="0" max="10" />
        </div>
        {error ? <p className="text-sm text-accent">{error}</p> : null}
        <button
          type="submit"
          disabled={pending || !ready}
          className="rounded-lg bg-accent px-4 py-3 font-medium text-background disabled:opacity-60"
        >
          {pending ? t.saving : t.save}
        </button>
      </form>

      <section className="rounded-2xl border border-line bg-card/95 p-5">
        <h2 className="font-display text-2xl uppercase">{t.recent}</h2>
        {journal.sets.length === 0 ? (
          <p className="mt-4 text-muted">{t.emptySets}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {journal.sets.map((set) => (
              <li key={set.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {set.image ? (
                    <img src={set.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-foreground">
                      {named(t.exercises, set.exercise)} · {equipmentLabel(t, set.handleId, set.handleName)} ·{" "}
                      {set.arm === "left" ? t.left : t.right}
                    </p>
                    <p className="text-sm text-muted">
                      {formatDate(set.trainedOn)}
                      {set.blockHeight ? ` · ${named(t.heights, set.blockHeight)}` : ""}
                      {set.band ? ` · ${named(t.bands, set.band)}` : ""}
                      {set.elbowPain > 0 ? ` · ${t.elbow.toLowerCase()} ${set.elbowPain}` : ""}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 font-mono text-lg text-good">
                  {formatKg(set.weightKg, locale)} {t.kg.toLowerCase()} ×{" "}
                  {set.holdSeconds != null ? `${set.holdSeconds} ${t.secondsShort}` : set.reps}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card/95 p-5">
          <h2 className="font-display text-2xl uppercase">{t.records}</h2>
          <p className="mt-1 text-sm text-muted">{t.recordHint}</p>
          {journal.records.length === 0 ? (
            <p className="mt-4 text-muted">{t.emptyRecords}</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {journal.records.map((record) => (
                <li
                  key={`${record.exercise}-${record.handleId}-${record.arm}`}
                  className="flex items-baseline justify-between gap-4"
                >
                  <span>
                    {named(t.exercises, record.exercise)} · {equipmentLabel(t, record.handleId, record.handleName)} ·{" "}
                    {record.arm === "left" ? t.left : t.right}
                  </span>
                  <span className="font-mono text-good">
                    {formatKg(record.weightKg, locale)} {t.kg.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-line bg-card/95 p-5">
          <h2 className="font-display text-2xl uppercase">{t.week}</h2>
          <p className="mt-2 text-sm text-muted">{t.weekHint}</p>
          {!ready ? (
            <p className="mt-4 text-muted">{t.loading}</p>
          ) : journal.missingExercises.length === 0 ? (
            <p className="mt-4 text-good">{t.weekDone}</p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {journal.missingExercises.map((id) => (
                <li key={id} className="rounded-full border border-line px-3 py-1 text-sm text-muted">
                  {t.exercises[id]}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function LangButton({
  current,
  value,
  label,
  onPick,
}: {
  current: "uk" | "en";
  value: "uk" | "en";
  label: string;
  onPick: (locale: "uk" | "en") => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onPick(value)}
      className={`rounded-full px-3 py-1 text-sm ${active ? "bg-accent text-background" : "text-foreground"}`}
    >
      {label}
    </button>
  );
}

function ArmButton({
  current,
  value,
  label,
  onPick,
}: {
  current: Arm;
  value: Arm;
  label: string;
  onPick: (arm: Arm) => void;
}) {
  return <ChoiceButton active={current === value} label={label} onPick={() => onPick(value)} wide />;
}

function ChoiceButton({
  active,
  label,
  onPick,
  wide,
}: {
  active: boolean;
  label: string;
  onPick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`${wide ? "flex-1" : ""} rounded-lg border px-3 py-2 text-sm ${
        active ? "border-accent bg-accent text-background" : "border-line bg-background text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: string;
  min?: string;
  max?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <input
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-line bg-background px-3 py-2 text-foreground"
        required
      />
    </label>
  );
}

function equipmentLabel(t: Messages, id: string, fallback: string) {
  if (id in t.equipment) return t.equipment[id as keyof Messages["equipment"]];
  return fallback;
}

function named(table: object, id: string) {
  const value = (table as Record<string, string>)[id];
  return value || id || "—";
}

function formatKg(kg: number, locale: "uk" | "en") {
  return new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-GB", {
    maximumFractionDigits: 3,
  }).format(kg);
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}
