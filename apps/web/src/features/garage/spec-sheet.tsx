import type { SpecRow } from "./spec-fields";

/** Technical sheet: value, and where each value came from. */
export function SpecSheet({ rows }: { rows: SpecRow[] }) {
  return (
    <dl className="flex flex-col divide-y divide-border">
      {rows.map((row) => (
        <div key={row.key} className="flex items-start justify-between gap-4 py-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-sm font-medium">{row.label}</dt>
            <span className="text-xs text-muted-foreground">
              {row.value === null ? "Sin fuente aún" : row.source}
            </span>
          </div>
          <dd
            className={`shrink-0 text-right text-[15px] font-semibold ${row.value === null ? "text-warning" : ""}`}
          >
            {row.value ?? "Por confirmar"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
