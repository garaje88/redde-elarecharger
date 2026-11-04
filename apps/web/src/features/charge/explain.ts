import { DEFAULT_CONSTANTS, splitDuration } from "@elacharger/calc";
import type { ChargeEstimate } from "@elacharger/schemas";
import { formatKw, formatNumber } from "@/lib/format";

export const LIMIT_LABELS: Record<ChargeEstimate["limited_by"], string> = {
  circuit: "el circuito de tu casa",
  charger: "tu cargador",
  onboard_charger: "el cargador a bordo del carro",
  vehicle_dc: "la carga DC del carro",
};

/** "5 h 40 min", "45 min". */
export function durationLabel(minutes: number): string {
  const { hours, minutes: rest } = splitDuration(minutes);
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`;
}

const time = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat("es-CO", { weekday: "long" });

/** "Termina hacia las 11:40 p. m.", naming the day when it is not today. */
export function endLabel(endsAt: Date, now: Date): string {
  const days = Math.round(
    (new Date(endsAt).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  const day = days === 0 ? "" : days === 1 ? "mañana " : `el ${weekday.format(endsAt)} `;
  return `Termina ${day}hacia las ${time.format(endsAt)}`;
}

/** "¿Cómo se calculó?" in plain Spanish, from the same numbers the engine used. */
export function explanation(
  estimate: ChargeEstimate,
  setup: { voltage: number; amperage: number; phases: 1 | 3 },
) {
  const circuitKw =
    (setup.voltage * setup.amperage * (setup.phases === 3 ? Math.sqrt(3) : 1)) / 1000;
  const ac = DEFAULT_CONSTANTS.defaultCurves.ac;
  const taperIndex = ac.findIndex((step) => step.fraction < 1);
  const taperFrom = taperIndex > 0 ? ac[taperIndex - 1]?.belowSoc : undefined;
  const taperFraction = taperIndex >= 0 ? ac[taperIndex]?.fraction : undefined;
  return [
    `Potencia del circuito: ${formatNumber(setup.voltage, 0)} V × ${formatNumber(setup.amperage, 0)} A${
      setup.phases === 3 ? " × √3" : ""
    } = ${formatKw(circuitKw)}.`,
    `Se toma la menor entre circuito, cargador y cargador a bordo: ${formatKw(estimate.grid_power_kw)}, limitada por ${
      LIMIT_LABELS[estimate.limited_by]
    }.`,
    `Eficiencia red → batería ${formatNumber(estimate.efficiency * 100, 0)} %: llegan ${formatKw(
      estimate.effective_kw,
    )} a la batería y se toman ${formatNumber(estimate.grid_kwh, 1)} kWh de la red.`,
    taperFrom !== undefined && taperFraction !== undefined
      ? `Por encima del ${formatNumber(taperFrom, 0)} % la potencia baja al ${formatNumber(taperFraction * 100, 0)} % para proteger la batería; el tiempo se suma en pasos de 1 %.`
      : "El tiempo se suma en pasos de 1 % de batería.",
  ];
}
