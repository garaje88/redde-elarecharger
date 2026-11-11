"use client";

import type { WeeklySummary } from "@elacharger/schemas";
import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { cop } from "@/features/sessions/format";

// Home dashboard (docs/mockups/Main.dc.html): one metric of the week at a time, by day.

type Metric = "cost" | "energy" | "km";

const TABS: { key: Metric; label: string }[] = [
  { key: "cost", label: "Costo" },
  { key: "energy", label: "Energía" },
  { key: "km", label: "Km" },
];

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

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

/** "6 % menos que la semana pasada", or a plain sentence when there is nothing to compare. */
function versusLastWeek(current: number, previous: number, empty: string) {
  if (previous === 0) return current === 0 ? empty : "Sin datos de la semana pasada";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "Igual que la semana pasada";
  return `${Math.abs(pct)} % ${pct < 0 ? "menos" : "más"} que la semana pasada`;
}

function viewFor(metric: Metric, week: WeeklySummary): View {
  const { totals, previous, currency } = week;
  if (metric === "cost") {
    return {
      caption: "Gastaste en recargas",
      value: cop(totals.cost, currency),
      delta: versusLastWeek(totals.cost, previous.cost, "Sin recargas esta semana"),
      side: week.cost_per_km === null ? "—" : cop(week.cost_per_km, currency),
      sideLabel: "por km",
      chartTitle: "Costo de recargas por día",
      legend: "Días con recarga",
      values: week.days.map((d) => d.cost),
      highlight: "nonzero",
      format: (v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`),
    };
  }
  if (metric === "energy") {
    const real = week.real_consumption_kwh_100km;
    const estimated = week.estimated_consumption_kwh_100km;
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
      values: week.days.map((d) => d.energy_kwh),
      highlight: "max",
      format: (v) => formatNumber(v, 1),
    };
  }
  return {
    caption: "Recorriste",
    value: `${formatNumber(totals.km, 0)} km`,
    delta: versusLastWeek(totals.km, previous.km, "Registra el odómetro en tus recargas"),
    side: formatNumber(week.km_per_day, 0),
    sideLabel: "km por día",
    chartTitle: "Kilómetros por día",
    legend: "Día con más recorrido",
    values: week.days.map((d) => d.km),
    highlight: "max",
    format: (v) => formatNumber(v, 0),
  };
}

export function WeeklyDashboard({ week }: { week: WeeklySummary }) {
  const [metric, setMetric] = useState<Metric>("cost");
  const view = viewFor(metric, week);
  const max = Math.max(...view.values);
  const described = view.values
    .map((v, i) => (v > 0 ? `${WEEKDAY_NAMES[i]} ${view.format(v)}` : null))
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <div
        role="tablist"
        aria-label="Métrica de la semana"
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
              aria-controls="week-summary"
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
        id="week-summary"
        aria-live="polite"
        aria-label="Resumen"
        className="flex items-end justify-between gap-3 rounded-[20px] bg-inverse p-4 text-inverse-foreground dark:border dark:border-border"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] text-inverse-muted">{view.caption}</span>
          <span
            data-testid="week-value"
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
          viewBox="0 0 330 132"
          role="img"
          aria-label={described ? `${view.chartTitle}: ${described}` : "Sin datos esta semana"}
          className="h-auto w-full"
        >
          <line x1="0" y1="110" x2="330" y2="110" className="stroke-border" strokeWidth="1" />
          {view.values.map((v, i) => {
            const h = v === 0 || max === 0 ? 3 : Math.max(4, Math.round((v / max) * 84));
            const strong = view.highlight === "max" ? v === max : v > 0;
            const fill = v === 0 ? "fill-border" : strong ? "fill-primary" : "fill-brand-soft";
            const x = 7 + i * 46;
            return (
              <g key={week.days[i]?.day ?? i}>
                <rect x={x} y={110 - h} width="32" height={h} rx="7" className={fill} />
                {v > 0 && (
                  <text
                    x={x + 16}
                    y={110 - h - 6}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="600"
                    className="fill-foreground"
                  >
                    {view.format(v)}
                  </text>
                )}
                <text
                  x={x + 16}
                  y="127"
                  textAnchor="middle"
                  fontSize="11"
                  className="fill-muted-foreground"
                >
                  {WEEKDAYS[i]}
                </text>
              </g>
            );
          })}
        </svg>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-primary" />
          {view.legend}
        </span>
      </section>
    </>
  );
}
