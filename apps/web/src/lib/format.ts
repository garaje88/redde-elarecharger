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

const COLOMBIAN_DECIMAL = /^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/;

/**
 * Parses a Colombian amount: comma decimals and optional dot thousands ("1.234,56").
 * A dot used as the decimal mark ("912.35") is rejected instead of being read as thousands.
 */
export function parseColombianDecimal(text: string): { value: number | null } | { error: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { value: null };
  if (!COLOMBIAN_DECIMAL.test(trimmed)) {
    return {
      error: trimmed.includes(".")
        ? "Usa coma para los decimales, por ejemplo 912,35."
        : "Escribe solo números, con coma para los decimales (máximo 2), por ejemplo 912,35.",
    };
  }
  return { value: Number(trimmed.replace(/\./g, "").replace(",", ".")) };
}
