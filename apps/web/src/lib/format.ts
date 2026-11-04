// Colombian formatting (es-CO): comma decimals, dot thousands.

const formatters = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number, maxDecimals = 1): string {
  let formatter = formatters.get(maxDecimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: maxDecimals });
    formatters.set(maxDecimals, formatter);
  }
  return formatter.format(value);
}

export const formatKw = (kw: number) => `${formatNumber(kw, 1)} kW`;

const monthYear = new Intl.DateTimeFormat("es-CO", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-11-04" → "nov 2026". */
export function formatSourceDate(isoDate: string | undefined): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00Z` : isoDate);
  if (Number.isNaN(date.getTime())) return null;
  const parts = monthYear.formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value.replace(".", "");
  const year = parts.find((part) => part.type === "year")?.value;
  return `${month} ${year}`;
}
