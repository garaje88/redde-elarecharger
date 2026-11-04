import type { Connector, ConnectorCode } from "@elacharger/schemas";

export type Compatibility = "compatible" | "adapter" | "incompatible" | "unknown";

/** Whether a charger plug fits the car's inlet directly, with a common adapter, or not at all. */
export function connectorCompatibility(
  vehicle: ConnectorCode | null,
  charger: ConnectorCode | null,
  connectors: Pick<Connector, "code" | "compatible_adapters">[],
): Compatibility {
  if (!vehicle || !charger) return "unknown";
  if (vehicle === charger) return "compatible";
  const adapters = (code: ConnectorCode) =>
    connectors.find((c) => c.code === code)?.compatible_adapters ?? [];
  return adapters(charger).includes(vehicle) || adapters(vehicle).includes(charger)
    ? "adapter"
    : "incompatible";
}

export const COMPATIBILITY_LABELS: Record<Compatibility, string> = {
  compatible: "Compatible con tu carro",
  adapter: "Requiere adaptador",
  incompatible: "No compatible con tu carro",
  unknown: "Compatibilidad por confirmar",
};
