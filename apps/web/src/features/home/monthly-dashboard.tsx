"use client";

import type { MonthlySummary } from "@elacharger/schemas";
import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { cop } from "@/features/sessions/format";

// Home dashboard (docs/mockups/Main.dc.html, by month): one metric at a time, one bar per day.

type Metric = "cost" | "energy" | "km";

const TABS: { key: Metric; label: string }[] = [
  { key: "cost", label: "Costo" },
  { key: "energy", label: "Energía" },
  { key: "km", label: "Km" },
];

interface View {
  caption: string;
  value: string;
  delta: string;
  side: string;
  sideLabel: string;
  chartTitle: string;
  legend: string;
  values: number[];
  /** "nonzero" marks every day with data; "max" only the highest. */
  highlight: "nonzero" | "max";
  format: (value: number) => string;
}

/** "6 % menos que el mes pasado", or a plain sentence when there is nothing to compare. */
function versusLastMonth(current: number, previous: number, empty: string) {
  if (previous === 0) return current === 0 ? empty : "Sin datos del mes pasado";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "Igual que el mes pasado";
  return `${Math.abs(pct)} % ${pct < 0 ? "menos" : "más"} que el mes pasado`;
}

function viewFor(metric: Metric, month: MonthlySummary): View {
  const { totals, previous, currency } = month;
  if (metric === "cost") {
    return {
      caption: "Gastaste en recargas",
      value: cop(totals.cost, currency),
      delta: versusLastMonth(totals.cost, previous.cost, "Sin recargas este mes"),
      side: month.cost_per_km === null ? "—" : cop(month.cost_per_km, currency),
      sideLabel: "por km",
      chartTitle: "Costo de recargas por día",
      legend: "Días con recarga",
      values: month.days.map((d) => d.cost),
      highlight: "nonzero",
      format: (v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`),
    };
  }
  if (metric === "energy") {
    const real = month.real_consumption_kwh_100km;
    const estimated = month.estimated_consumption_kwh_100km;
    let delta = "Registra el odómetro en tus recargas para medirla";
    if (real !== null && estimated) {
      const pct = Math.round(((real - estimated) / estimated) * 100);
      delta =
        pct === 0
          ? "Igual a lo estimado"
          : `${Math.abs(pct)} % ${pct > 0 ? "sobre" : "bajo"} lo estimado`;
    } else if (totals.energy_kwh > 0) {
      delta = "";
    }
    return {
      caption: "Energía consumida",
      value: `${formatNumber(totals.energy_kwh, 1)} kWh`,
      delta,
      side: real === null ? "—" : formatNumber(real, 1),
      sideLabel: "kWh/100 km",
      chartTitle: "kWh consumidos por día",
      legend: "Día de mayor consumo",
      values: month.days.map((d) => d.energy_kwh),
      highlight: "max",
      format: (v) => formatNumber(v, 1),
    };
  }
  return {
    caption: "Recorriste",
    value: `${formatNumber(totals.km, 0)} km`,
    delta: versusLastMonth(totals.km, previous.km, "Registra el odómetro en tus recargas"),
    side: formatNumber(month.km_per_day, 0),
    sideLabel: "km por día",
    chartTitle: "Kilómetros por día",
    legend: "Día con más recorrido",
    values: month.days.map((d) => d.km),
    highlight: "max",
    format: (v) => formatNumber(v, 0),
  };
}

// Chart geometry (viewBox units).
const WIDTH = 330;
const BASELINE = 122;
const MAX_BAR = 84;
const LABEL_GAP = 26;
const TICKS = [1, 8, 15, 22, 29];

/**
 * Value labels over the bars. Two charges a few days apart would overlap, so a label that
 * would collide goes one row higher; when both rows are taken it is left out (the bar and the
 * chart's accessible description still carry the value).
 */
function labelRows(centers: (number | null)[]) {
  const lastX = [-Infinity, -Infinity];
  return centers.map((x) => {
    if (x === null) return null;
    const row = lastX.findIndex((last) => x - last >= LABEL_GAP);
    if (row === -1) return null;
    lastX[row] = x;
    return row;
  });
}

export function MonthlyDashboard({ month }: { month: MonthlySummary }) {
  const [metric, setMetric] = useState<Metric>("cost");
  const view = viewFor(metric, month);
  const max = Math.max(...view.values);
  const slot = WIDTH / view.values.length;
  const barWidth = Math.max(4, slot * 0.62);
  const center = (i: number) => i * slot + slot / 2;
  const rows = labelRows(view.values.map((v, i) => (v > 0 ? center(i) : null)));
  const described = view.values
    .map((v, i) => (v > 0 ? `día ${i + 1}: ${view.format(v)}` : null))
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <div
        role="tablist"
        aria-label="Métrica del mes"
        className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1"
      >
        {TABS.map((tab) => {
          const selected = tab.key === metric;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="month-summary"
              onClick={() => setMetric(tab.key)}
              className={`min-h-10 rounded-[9px] text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                selected ? "bg-card font-semibold shadow-sm" : "font-medium text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <section
        id="month-summary"
        aria-live="polite"
        aria-label="Resumen"
        className="flex items-end justify-between gap-3 rounded-[20px] bg-inverse p-4 text-inverse-foreground dark:border dark:border-border"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] text-inverse-muted">{view.caption}</span>
          <span
            data-testid="month-value"
            className="font-heading text-[40px] leading-none font-bold break-words"
          >
            {view.value}
          </span>
          {view.delta && (
            <span className="text-[13px] font-semibold text-brand-bright">{view.delta}</span>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span className="font-heading text-[22px] font-bold">{view.side}</span>
          <span className="text-xs text-inverse-muted">{view.sideLabel}</span>
        </div>
      </section>

      <section
        aria-label="Por día"
        className="flex flex-col gap-2 rounded-[20px] border border-border bg-card px-3.5 pt-3.5 pb-2.5"
      >
        <h2 className="text-sm font-semibold">{view.chartTitle}</h2>
        <svg
          viewBox={`0 0 ${WIDTH} 148`}
          role="img"
          aria-label={described ? `${view.chartTitle}: ${described}` : "Sin datos este mes"}
          className="h-auto w-full"
        >
          <line
            x1="0"
            y1={BASELINE}
            x2={WIDTH}
            y2={BASELINE}
            className="stroke-border"
            strokeWidth="1"
          />
          {view.values.map((v, i) => {
            const h = v === 0 || max === 0 ? 2 : Math.max(4, Math.round((v / max) * MAX_BAR));
            const strong = view.highlight === "max" ? v === max : v > 0;
            const fill = v === 0 ? "fill-border" : strong ? "fill-primary" : "fill-brand-soft";
            const row = rows[i];
            return (
              <g key={month.days[i]?.day ?? i}>
                <rect
                  x={center(i) - barWidth / 2}
                  y={BASELINE - h}
                  width={barWidth}
                  height={h}
                  rx={Math.min(3, barWidth / 2)}
                  className={fill}
                />
                {row != null && (
                  <text
                    x={center(i)}
                    y={BASELINE - h - 6 - row * 13}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    className="fill-foreground"
                  >
                    {view.format(v)}
                  </text>
                )}
              </g>
            );
          })}
          {TICKS.filter((day) => day <= view.values.length).map((day) => (
            <text
              key={day}
              x={center(day - 1)}
              y="140"
              textAnchor="middle"
              fontSize="11"
              className="fill-muted-foreground"
            >
              {day}
            </text>
          ))}
        </svg>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-primary" />
          {view.legend}
        </span>
      </section>
    </>
  );
}
