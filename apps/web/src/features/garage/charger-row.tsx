import type { Charger } from "@elacharger/schemas";
import { formatKw, formatNumber } from "@/lib/format";
import { CONNECTOR_LABELS } from "./spec-fields";

export function chargerDetails(charger: Charger): string {
  return [
    `${formatNumber(charger.voltage_v, 0)} V`,
    `${formatNumber(charger.circuit_amperage_a, 0)} A`,
    charger.phases === 3 ? "trifásico" : "monofásico",
    charger.charger_model?.kind === "portable" ? "portátil" : null,
    charger.connector ? CONNECTOR_LABELS[charger.connector] : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "Nivel 1" at 110–120 V, "Nivel 2" above. */
export const chargerLevel = (charger: Charger) =>
  charger.voltage_v <= 130 ? "Nivel 1" : "Nivel 2";

export function ChargerRow({ charger, action }: { charger: Charger; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">
          {charger.name} · {chargerLevel(charger)}
        </span>
        <span className="text-[13px] text-muted-foreground">{chargerDetails(charger)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="font-heading text-base font-semibold">{formatKw(charger.power.kw)}</span>
        {action}
      </span>
    </div>
  );
}
