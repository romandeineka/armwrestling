"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Locale, Messages } from "@/i18n/messages";
import type { Arm, RecordView } from "@/server/journal";

// Кольори серій перевірені скриптом палітри на фоні картки #1c1916:
// розрізняються і при дальтонізмі, контраст з фоном не менше 3:1.
const SERIES_COLOR: Record<Arm, string> = { right: "#3987e5", left: "#d95926" };

const WIDTH = 600;
const HEIGHT = 260;
const MARGIN = { top: 16, right: 56, bottom: 28, left: 44 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const DAY_MS = 24 * 60 * 60 * 1000;

type Point = { date: string; time: number; weightKg: number };
type Series = { arm: Arm; points: Point[] };

// Найкращий результат кожного дня для однієї руки, від старих до нових.
function dailyBest(record: RecordView, arm: Arm): Point[] {
  const side = record[arm];
  if (!side) return [];
  const byDate = new Map<string, number>();
  for (const set of [side.best, ...side.history]) {
    byDate.set(set.trainedOn, Math.max(byDate.get(set.trainedOn) ?? 0, set.weightKg));
  }
  return [...byDate.entries()]
    .map(([date, weightKg]) => ({ date, time: Date.parse(date), weightKg }))
    .sort((a, b) => a.time - b.time);
}

export function progressSeries(record: RecordView): Series[] {
  return (["right", "left"] as const)
    .map((arm) => ({ arm, points: dailyBest(record, arm) }))
    .filter((series) => series.points.length > 0);
}

// Круглі поділки осі: 1, 2, 2.5 або 5, помножені на степінь десяти.
function niceTicks(min: number, max: number, count = 4) {
  const raw = (max - min) / count || 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return ticks;
}

export function ProgressChart({
  record,
  t,
  locale,
}: {
  record: RecordView;
  t: Messages;
  locale: Locale;
}) {
  const [active, setActive] = useState<number | null>(null);
  const series = progressSeries(record);
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  if (dates.length < 2) {
    return <p className="text-sm text-muted">{t.chartNeedMore}</p>;
  }
  const times = dates.map((date) => Date.parse(date));
  const weights = series.flatMap((s) => s.points.map((p) => p.weightKg));

  const kg = (value: number) =>
    new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-GB", {
      maximumFractionDigits: 2,
    }).format(value);
  const shortDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;
  const armLabel = (arm: Arm) => (arm === "left" ? t.left : t.right);

  const minTime = Math.min(...times) - (times.length === 1 ? DAY_MS : 0);
  const maxTime = Math.max(...times) + (times.length === 1 ? DAY_MS : 0);
  const ticks = niceTicks(Math.min(...weights), Math.max(...weights));
  const yMin = ticks[0]!;
  const yMax = ticks[ticks.length - 1]! === yMin ? yMin + 1 : ticks[ticks.length - 1]!;

  const x = (time: number) => MARGIN.left + ((time - minTime) / (maxTime - minTime)) * PLOT_W;
  const y = (weightKg: number) => MARGIN.top + (1 - (weightKg - yMin) / (yMax - yMin)) * PLOT_H;

  // Підписи значень на кінцях ліній, але тільки якщо вони не налазять один на одного.
  const ends = series.map((s) => s.points[s.points.length - 1]!);
  const endLabels =
    ends.length < 2 || Math.abs(y(ends[0]!.weightKg) - y(ends[1]!.weightKg)) >= 16;

  // Перехрестя шукає найближчу дату до вказівника, а не саму лінію.
  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * WIDTH;
    let nearest = 0;
    times.forEach((time, index) => {
      if (Math.abs(x(time) - px) < Math.abs(x(times[nearest]!) - px)) nearest = index;
    });
    setActive(nearest);
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "ArrowRight") setActive((i) => Math.min(dates.length - 1, (i ?? -1) + 1));
    if (event.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? dates.length) - 1));
  }

  const activeDate = active != null ? dates[active] : null;

  return (
    <div className="flex flex-col gap-3">
      {series.length > 1 ? (
        <ul className="flex gap-4 text-sm text-muted">
          {series.map((s) => (
            <li key={s.arm} className="flex items-center gap-2">
              <span className="h-0.5 w-4 rounded" style={{ background: SERIES_COLOR[s.arm] }} />
              {armLabel(s.arm)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none outline-none focus-visible:ring-1 focus-visible:ring-accent"
          role="img"
          aria-label={t.progress}
          tabIndex={0}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(dates.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--muted)"
                fontSize={11}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {kg(tick)}
              </text>
            </g>
          ))}

          {[dates[0]!, dates[dates.length - 1]!].map((date, index) => (
            <text
              key={date}
              x={x(Date.parse(date))}
              y={HEIGHT - 8}
              textAnchor={index === 0 ? "start" : "end"}
              fill="var(--muted)"
              fontSize={11}
            >
              {shortDate(date)}
            </text>
          ))}

          {activeDate ? (
            <line
              x1={x(Date.parse(activeDate))}
              x2={x(Date.parse(activeDate))}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_H}
              stroke="var(--muted)"
              strokeWidth={1}
            />
          ) : null}

          {series.map((s) => (
            <g key={s.arm}>
              <polyline
                points={s.points.map((p) => `${x(p.time)},${y(p.weightKg)}`).join(" ")}
                fill="none"
                stroke={SERIES_COLOR[s.arm]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.points.map((p) => (
                <circle
                  key={p.date}
                  cx={x(p.time)}
                  cy={y(p.weightKg)}
                  r={p.date === activeDate ? 5 : 4}
                  fill={SERIES_COLOR[s.arm]}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ))}
              {endLabels ? (
                <text
                  x={x(s.points[s.points.length - 1]!.time) + 10}
                  y={y(s.points[s.points.length - 1]!.weightKg)}
                  dominantBaseline="middle"
                  fill="var(--foreground)"
                  fontSize={12}
                >
                  {kg(s.points[s.points.length - 1]!.weightKg)}
                </text>
              ) : null}
            </g>
          ))}
        </svg>

        {activeDate ? (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-background px-3 py-2 text-sm shadow-lg"
            style={{
              left: `${(x(Date.parse(activeDate)) / WIDTH) * 100}%`,
              transform: `translateX(${active! > dates.length / 2 ? "-105%" : "5%"})`,
            }}
          >
            <p className="text-xs text-muted">{shortDate(activeDate)}</p>
            {series.map((s) => {
              const point = s.points.find((p) => p.date === activeDate);
              return (
                <p key={s.arm} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="h-0.5 w-3 rounded" style={{ background: SERIES_COLOR[s.arm] }} />
                  <span className="font-semibold text-foreground">
                    {point ? `${kg(point.weightKg)} ${t.kg.toLowerCase()}` : "—"}
                  </span>
                  <span className="text-muted">{armLabel(s.arm)}</span>
                </p>
              );
            })}
          </div>
        ) : null}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1 font-normal">{t.date}</th>
            {series.map((s) => (
              <th key={s.arm} className="py-1 text-right font-normal">
                {armLabel(s.arm)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line" style={{ fontVariantNumeric: "tabular-nums" }}>
          {[...dates].reverse().map((date) => (
            <tr key={date}>
              <td className="py-1 text-muted">{shortDate(date)}</td>
              {series.map((s) => {
                const point = s.points.find((p) => p.date === date);
                return (
                  <td key={s.arm} className="py-1 text-right text-foreground">
                    {point ? kg(point.weightKg) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
