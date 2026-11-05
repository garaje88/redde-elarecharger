import { durationLabel } from "@/features/charge/explain";
import { formatNumber } from "@/lib/format";

const BOGOTA = "America/Bogota";
const dayMonth = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: BOGOTA,
});
const monthYear = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortMonth = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" });

const monthDate = (month: string) => new Date(`${month}-01T12:00:00Z`);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "2026-10" → "Octubre 2026". */
export const monthTitle = (month: string) =>
  capitalize(monthYear.format(monthDate(month)).replace(" de ", " "));

/** "2026-10" → "oct". */
export const monthShort = (month: string) => shortMonth.format(monthDate(month)).replace(".", "");

/** "29 oct". */
export const sessionDay = (iso: string) =>
  dayMonth.format(new Date(iso)).replace(" de ", " ").replace(".", "");

export function shiftMonth(month: string, delta: number): string {
  const [year = 0, mon = 1] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "18 → 85 % · 6 h 20 min". */
export function sessionSummary(session: {
  start_soc: number | null;
  end_soc: number | null;
  started_at: string;
  ended_at: string | null;
}): string {
  const parts: string[] = [];
  if (session.start_soc !== null && session.end_soc !== null) {
    parts.push(`${formatNumber(session.start_soc, 0)} → ${formatNumber(session.end_soc, 0)} %`);
  }
  if (session.ended_at) {
    parts.push(
      durationLabel(
        (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60_000,
      ),
    );
  }
  return parts.join(" · ");
}

export const cop = (value: number, currency = "COP") =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    value,
  );
