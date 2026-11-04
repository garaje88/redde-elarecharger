/** Mirrors `public.catalog_normalize` in SQL so imported names match what users search. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/([a-z])[-_.]([0-9])/g, "$1$2")
    .replace(/[^a-z0-9áéíóúñü]+/g, " ")
    .trim();
}

export function slugify(value: string): string {
  return normalize(value.normalize("NFD").replace(/[̀-ͯ]/g, ""))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Collapses inner whitespace and trims; returns "" for nullish input. */
export function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** A positive finite number, or null. */
export function positive(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}
