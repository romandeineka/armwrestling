"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/use-locale";
import type { Locale, Messages } from "@/i18n/messages";
import {
  BANDS,
  BLOCK_HEIGHTS,
  ISOMETRIC_EXERCISE,
  kyivToday,
  type BandId,
  type BlockHeight,
  type ExerciseId,
} from "@/server/catalog";
import type { Arm, JournalView, RecordView, SetView } from "@/server/journal";

type Tab = "new" | "records";

const emptyJournal: JournalView = {
  handles: [],
  records: [],
};

const BAND_SWATCH: Record<BandId, string> = {
  green_heavy: "bg-[#1f7a3a]",
  purple: "bg-[#7a3ea1]",
  green_light: "bg-[#8fbf45]",
  red: "bg-[#d24b4b]",
};

export function JournalBoard() {
  const { locale, setLocale, t } = useLocale();
  const [tab, setTab] = useState<Tab>("new");
  const [journal, setJournal] = useState<JournalView>(emptyJournal);
  const [handleId, setHandleId] = useState("");
  const [exercise, setExercise] = useState<ExerciseId>("pronation");
  const [arm, setArm] = useState<Arm>("right");
  const [weightKg, setWeightKg] = useState("");
  const [reps, setReps] = useState("");
  const [holdSeconds, setHoldSeconds] = useState("");
  const [setCount, setSetCount] = useState("");
  const [blockHeight, setBlockHeight] = useState<BlockHeight | "">("");
  const [band, setBand] = useState<BandId | "">("");
  const [trainedOn, setTrainedOn] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoInputKey, setVideoInputKey] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
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
      let videoUrl: string | null = null;
      if (videoFile) {
        try {
          videoUrl = await uploadVideo(videoFile, setProgress);
        } catch {
          setError(t.errors.upload_failed);
          return;
        } finally {
          setProgress(null);
        }
      }

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
          setCount: Number(setCount),
          blockHeight,
          band: band || null,
          trainedOn,
          videoUrl,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(errorText(t, data.error));
        return;
      }
      setWeightKg("");
      setReps("");
      setSetCount("");
      setHoldSeconds("");
      setVideoFile(null);
      setVideoInputKey((key) => key + 1);
      await load();
      setTab("records");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10">
      <header className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs tracking-[0.28em] text-muted uppercase">
              {t.kicker}
            </p>
            <div
              className="flex rounded-full border border-line bg-card p-1"
              aria-label={t.language}
            >
              <LangButton
                current={locale}
                value="uk"
                label="UA"
                onPick={setLocale}
              />
              <LangButton
                current={locale}
                value="en"
                label="EN"
                onPick={setLocale}
              />
            </div>
          </div>
          <h1 className="font-display text-5xl tracking-tight text-foreground uppercase">
            {t.title}
          </h1>
          <p className="max-w-xl text-muted">{t.intro}</p>
        </div>
        <figure className="overflow-hidden rounded-2xl border border-line shadow-lg">
          <img
            src="/media/table-side.jpg"
            alt={t.tableAlt}
            className="h-44 w-full object-cover"
          />
        </figure>
      </header>

      <nav
        role="tablist"
        className="flex gap-1 self-start rounded-full border border-line bg-card p-1"
      >
        <TabButton
          active={tab === "new"}
          label={t.tabNew}
          onPick={() => setTab("new")}
        />
        <TabButton
          active={tab === "records"}
          label={t.tabRecords}
          onPick={() => setTab("records")}
        />
      </nav>

      {tab === "new" ? (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-5 rounded-2xl border border-line bg-card/95 p-5"
        >
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
                onChange={(event) =>
                  setExercise(event.target.value as ExerciseId)
                }
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
                      <img
                        src={handle.image}
                        alt=""
                        className="h-16 w-full object-cover"
                      />
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
            <ArmButton
              current={arm}
              value="right"
              onPick={setArm}
              label={t.right}
            />
            <ArmButton
              current={arm}
              value="left"
              onPick={setArm}
              label={t.left}
            />
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
              <img
                src="/media/resistance-bands.jpg"
                alt={t.bandsAlt}
                className="h-28 w-full rounded-lg object-cover"
              />
              <div className="grid grid-cols-2 gap-1">
                <ChoiceButton
                  active={band === ""}
                  label={t.bandNone}
                  onPick={() => setBand("")}
                />
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
                    <span
                      className={`h-3 w-3 rounded-full ${BAND_SWATCH[id]}`}
                    />
                    {t.bands[id]}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label={t.kg}
              value={weightKg}
              onChange={setWeightKg}
              step="0.5"
            />
            <NumberField
              label={t.setCount}
              value={setCount}
              onChange={setSetCount}
              step="1"
              min="1"
              max="20"
            />
            {isometric ? (
              <NumberField
                label={t.seconds}
                value={holdSeconds}
                onChange={setHoldSeconds}
                step="1"
                min="1"
                max="600"
              />
            ) : (
              <NumberField
                label={t.reps}
                value={reps}
                onChange={setReps}
                step="1"
                min="1"
              />
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm text-muted">
            {t.video}
            <span className="text-xs">{t.videoHint}</span>
            <input
              key={videoInputKey}
              type="file"
              accept="video/*"
              onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
              className="rounded-lg border border-line bg-background px-3 py-2 text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1 file:text-background"
            />
          </label>

          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <button
            type="submit"
            disabled={pending || !ready}
            className="rounded-lg bg-accent px-4 py-3 font-medium text-background disabled:opacity-60"
          >
            {progress != null
              ? `${t.uploading} ${progress}%`
              : pending
                ? t.saving
                : t.save}
          </button>
        </form>
      ) : (
        <section className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t.recordHint}</p>
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          {!ready ? (
            <p className="text-muted">{t.loading}</p>
          ) : journal.records.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card/95 p-5 text-muted">
              {t.emptyRecords}
            </p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {journal.records.map((record) => (
                <RecordCard
                  key={record.key}
                  record={record}
                  t={t}
                  locale={locale}
                  onChanged={load}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

function RecordCard({
  record,
  t,
  locale,
  onChanged,
}: {
  record: RecordView;
  t: Messages;
  locale: Locale;
  onChanged: () => Promise<void>;
}) {
  const { best } = record;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-card/95 p-4">
      <div className="flex items-center gap-3">
        {record.image ? (
          <img
            src={record.image}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <p className="font-display text-lg text-foreground uppercase">
            {named(t.exercises, record.exercise)}
          </p>
          <p className="text-sm text-muted">
            {equipmentLabel(t, record.handleId, record.handleName)} ·{" "}
            {record.arm === "left" ? t.left : t.right}
          </p>
        </div>
      </div>

      <div>
        <p className="font-mono text-2xl text-good">
          {formatResult(best, t, locale)}
        </p>
        <p className="text-sm text-muted">{setDetails(best, t)}</p>
      </div>

      {best.videoUrl ? (
        <video
          src={best.videoUrl}
          controls
          playsInline
          preload="metadata"
          className="w-full rounded-lg bg-black"
        />
      ) : (
        <AttachVideoButton setId={best.id} t={t} onDone={onChanged} />
      )}

      {record.history.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">
            {t.history} · {record.history.length}
          </summary>
          <ul className="mt-2 divide-y divide-line">
            {record.history.map((set) => (
              <li
                key={set.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="text-muted">{formatDate(set.trainedOn)}</span>
                <span className="font-mono text-foreground">
                  {formatResult(set, t, locale)}
                </span>
                {set.videoUrl ? (
                  <a
                    href={set.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline"
                  >
                    ▶ {t.video}
                  </a>
                ) : (
                  <AttachVideoButton
                    setId={set.id}
                    t={t}
                    onDone={onChanged}
                    compact
                  />
                )}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

function AttachVideoButton({
  setId,
  t,
  onDone,
  compact,
}: {
  setId: string;
  t: Messages;
  onDone: () => Promise<void>;
  compact?: boolean;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError("");
    setProgress(0);
    try {
      const videoUrl = await uploadVideo(file, setProgress);
      const response = await fetch(`/api/sets/${setId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(errorText(t, data.error));
        return;
      }
      await onDone();
    } catch {
      setError(t.errors.upload_failed);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        className={`cursor-pointer rounded-lg border border-dashed border-line text-center text-muted hover:border-accent hover:text-foreground ${
          compact ? "px-2 py-1 text-xs" : "px-3 py-6 text-sm"
        }`}
      >
        {progress != null ? `${t.uploading} ${progress}%` : `+ ${t.attachVideo}`}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          disabled={progress != null}
          onChange={(event) => void onPick(event.target.files?.[0])}
        />
      </label>
      {error ? <p className="text-xs text-accent">{error}</p> : null}
    </div>
  );
}

function TabButton({
  active,
  label,
  onPick,
}: {
  active: boolean;
  label: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onPick}
      className={`rounded-full px-5 py-2 text-sm font-medium uppercase ${
        active ? "bg-accent text-background" : "text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function LangButton({
  current,
  value,
  label,
  onPick,
}: {
  current: Locale;
  value: Locale;
  label: string;
  onPick: (locale: Locale) => void;
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
  return (
    <ChoiceButton
      active={current === value}
      label={label}
      onPick={() => onPick(value)}
      wide
    />
  );
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
        active
          ? "border-accent bg-accent text-background"
          : "border-line bg-background text-foreground"
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

// Файл іде з браузера прямо у Vercel Blob; наш сервер лише видає дозвіл.
async function uploadVideo(file: File, onProgress: (percent: number) => void) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const blob = await upload(`records/video.${extension}`, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    multipart: file.size > 20 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
  });
  return blob.url;
}

function errorText(t: Messages, code: string | undefined) {
  return t.errors[(code ?? "save_failed") as keyof Messages["errors"]] ?? t.errors.save_failed;
}

function formatResult(set: SetView, t: Messages, locale: Locale) {
  const amount =
    set.holdSeconds != null ? `${set.holdSeconds} ${t.secondsShort}` : set.reps;
  return `${formatKg(set.weightKg, locale)} ${t.kg.toLowerCase()} · ${set.setCount} × ${amount}`;
}

function setDetails(set: SetView, t: Messages) {
  return [
    formatDate(set.trainedOn),
    set.blockHeight ? named(t.heights, set.blockHeight) : "",
    set.band ? named(t.bands, set.band) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function equipmentLabel(t: Messages, id: string, fallback: string) {
  if (id in t.equipment) return t.equipment[id as keyof Messages["equipment"]];
  return fallback;
}

function named(table: object, id: string) {
  const value = (table as Record<string, string>)[id];
  return value || id || "—";
}

function formatKg(kg: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-GB", {
    maximumFractionDigits: 3,
  }).format(kg);
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}
