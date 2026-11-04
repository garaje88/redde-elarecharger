"use client";

import {
  CONNECTOR_CODES,
  RANGE_CYCLES,
  type ConnectorCode,
  type VehicleOverrides,
  type VehicleSpec,
} from "@elacharger/schemas";
import { CONNECTOR_LABELS } from "./spec-fields";

type NumberField =
  "battery_usable_kwh" | "range_km" | "curb_weight_kg" | "ac_onboard_kw" | "dc_max_kw";

const NUMBER_FIELDS: { key: NumberField; label: string; unit: string }[] = [
  { key: "battery_usable_kwh", label: "Batería útil", unit: "kWh" },
  { key: "range_km", label: "Autonomía", unit: "km" },
  { key: "curb_weight_kg", label: "Peso vacío", unit: "kg" },
  { key: "ac_onboard_kw", label: "Carga AC a bordo", unit: "kW" },
  { key: "dc_max_kw", label: "DC máx.", unit: "kW" },
];

const AC = CONNECTOR_CODES.filter((code) => ["TYPE1", "TYPE2", "GBT_AC"].includes(code));
const DC = CONNECTOR_CODES.filter((code) => !AC.includes(code));

const parseDecimal = (text: string) => {
  const value = Number(text.replace(/\./g, "").replace(",", "."));
  return text.trim() === "" || !Number.isFinite(value) ? undefined : value;
};

const fieldClass =
  "min-h-11 w-full rounded-xl border border-input bg-card px-3 text-[15px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * Corrections the user makes for their own car. Empty inputs keep the catalog value; the server
 * validates the ranges again.
 */
export function OverridesForm({
  base,
  value,
  onChange,
}: {
  base: VehicleSpec;
  value: VehicleOverrides;
  onChange: (next: VehicleOverrides) => void;
}) {
  const set = <K extends keyof VehicleOverrides>(key: K, next: VehicleOverrides[K] | undefined) => {
    const copy = { ...value };
    if (next === undefined) delete copy[key];
    else copy[key] = next;
    onChange(copy);
  };
  const placeholder = (current: number | string | null) =>
    current === null ? "Por confirmar" : String(current).replace(".", ",");

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm text-muted-foreground">
        Solo cambia lo que sepas de tu carro. Tus correcciones no modifican el catálogo.
      </legend>
      <div className="grid grid-cols-2 gap-3">
        {NUMBER_FIELDS.map(({ key, label, unit }) => (
          <label key={key} className="flex flex-col gap-1 text-sm font-medium">
            {label} ({unit})
            <input
              inputMode="decimal"
              className={fieldClass}
              placeholder={placeholder(base[key])}
              defaultValue={value[key] === undefined ? "" : String(value[key]).replace(".", ",")}
              onChange={(event) => set(key, parseDecimal(event.target.value))}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Ciclo de autonomía
          <select
            className={fieldClass}
            value={value.range_cycle ?? ""}
            onChange={(event) =>
              set(
                "range_cycle",
                (event.target.value || undefined) as VehicleOverrides["range_cycle"],
              )
            }
          >
            <option value="">{base.range_cycle ?? "Sin cambio"}</option>
            {RANGE_CYCLES.map((cycle) => (
              <option key={cycle} value={cycle}>
                {cycle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Fases AC
          <select
            className={fieldClass}
            value={value.ac_phases ?? ""}
            onChange={(event) =>
              set(
                "ac_phases",
                event.target.value === "" ? undefined : (Number(event.target.value) as 1 | 3),
              )
            }
          >
            <option value="">Sin cambio</option>
            <option value="1">Monofásico</option>
            <option value="3">Trifásico</option>
          </select>
        </label>
        {(
          [
            ["connector_ac", "Conector AC", AC],
            ["connector_dc", "Conector DC", DC],
          ] as const
        ).map(([key, label, codes]) => (
          <label key={key} className="flex flex-col gap-1 text-sm font-medium">
            {label}
            <select
              className={fieldClass}
              value={value[key] ?? ""}
              onChange={(event) =>
                set(key, (event.target.value || undefined) as ConnectorCode | undefined)
              }
            >
              <option value="">{base[key] ? CONNECTOR_LABELS[base[key]] : "Sin cambio"}</option>
              {codes.map((code) => (
                <option key={code} value={code}>
                  {CONNECTOR_LABELS[code]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
