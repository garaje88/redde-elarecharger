import { baseConsumptionKwh100km } from "@elacharger/calc";
import type { ConnectorCode, FieldSource, VehicleSpec } from "@elacharger/schemas";
import { formatNumber, formatSourceDate } from "@/lib/format";

export const CONNECTOR_LABELS: Record<ConnectorCode, string> = {
  TYPE1: "Tipo 1",
  TYPE2: "Tipo 2",
  GBT_AC: "GB/T AC",
  CCS1: "CCS1",
  CCS2: "CCS2",
  CHADEMO: "CHAdeMO",
  GBT_DC: "GB/T DC",
  NACS: "NACS",
};

export interface SpecRow {
  key: string;
  label: string;
  /** null = Por confirmar. */
  value: string | null;
  source: string;
}

type Sources = Partial<Record<string, FieldSource>>;

/** "Open EV Data · nov 2026", or the fallback when the field has no source. */
export function sourceLabel(sources: Sources, key: string, fallback = "Sin fuente aún"): string {
  const source = sources[key];
  if (!source) return fallback;
  const date = formatSourceDate(source.retrieved_at);
  return date ? `${source.source} · ${date}` : source.source;
}

function consumption(
  spec: VehicleSpec,
  sources: Sources,
): { value: string | null; source: string } {
  if (spec.consumption_kwh_100km !== null) {
    return {
      value: `${formatNumber(spec.consumption_kwh_100km)} kWh/100 km`,
      source: sourceLabel(sources, "consumption_kwh_100km"),
    };
  }
  if (spec.battery_usable_kwh !== null && spec.range_km !== null && spec.range_cycle !== null) {
    const derived = baseConsumptionKwh100km({
      usableKwh: spec.battery_usable_kwh,
      rangeKm: spec.range_km,
      rangeCycle: spec.range_cycle,
    });
    return { value: `${formatNumber(derived)} kWh/100 km`, source: "Calculado desde autonomía" };
  }
  return { value: null, source: "Sin fuente aún" };
}

/** Rows of the technical sheet, in the order the garage shows them. */
export function specRows(spec: VehicleSpec, sources: Sources): SpecRow[] {
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(" ") || null;
  const connectors = [spec.connector_ac, spec.connector_dc]
    .filter((code): code is ConnectorCode => code !== null)
    .map((code) => CONNECTOR_LABELS[code]);

  return [
    {
      key: "battery_usable_kwh",
      label: "Batería útil",
      value:
        spec.battery_usable_kwh === null
          ? null
          : join(`${formatNumber(spec.battery_usable_kwh, 2)} kWh`, spec.chemistry),
      source: sourceLabel(sources, "battery_usable_kwh"),
    },
    {
      key: "range_km",
      label: "Autonomía",
      value:
        spec.range_km === null
          ? null
          : join(`${formatNumber(spec.range_km, 0)} km`, spec.range_cycle),
      source: sourceLabel(sources, "range_km"),
    },
    { key: "consumption_kwh_100km", label: "Consumo base", ...consumption(spec, sources) },
    {
      key: "curb_weight_kg",
      label: "Peso vacío",
      value: spec.curb_weight_kg === null ? null : `${formatNumber(spec.curb_weight_kg, 0)} kg`,
      source: sourceLabel(sources, "curb_weight_kg"),
    },
    {
      key: "ac_onboard_kw",
      label: "Carga AC a bordo",
      value:
        spec.ac_onboard_kw === null
          ? null
          : join(
              `${formatNumber(spec.ac_onboard_kw)} kW`,
              spec.ac_phases === 3 ? "· trifásico" : spec.ac_phases === 1 ? "· monofásico" : null,
            ),
      source: sourceLabel(sources, "ac_onboard_kw"),
    },
    {
      key: "dc_max_kw",
      label: "DC máx.",
      value: spec.dc_max_kw === null ? null : `${formatNumber(spec.dc_max_kw, 0)} kW`,
      source: sourceLabel(sources, "dc_max_kw"),
    },
    {
      key: "connectors",
      label: "Conectores",
      value: connectors.length > 0 ? connectors.join(" · ") : null,
      source: sourceLabel(sources, spec.connector_dc ? "connector_dc" : "connector_ac"),
    },
  ];
}
