// Playground for the engine: edit the scenarios below and run `pnpm calc:demo` from the repo root.
import {
  CalcInputError,
  type ChargeInput,
  type TripInput,
  estimateCharge,
  estimateTrip,
  splitDuration,
} from "../src/index";

// Deepal S05 E-Max (docs/reference). Curb weight is an assumption: the sheet does not list it.
const vehicle = {
  usableKwh: 56.12,
  rangeKm: 458,
  rangeCycle: "NEDC",
  curbWeightKg: 1852,
  acOnboardKw: 6.6,
  dcMaxKw: null,
} as const;

const chargeScenarios: Record<string, ChargeInput> = {
  "Nivel 1 · 110 V 12 A · 20 → 80 %": {
    vehicle,
    charger: { current: "AC", voltageV: 110, currentA: 12, phases: 1 },
    startSocPct: 20,
    targetSocPct: 80,
    tariffPerKwh: 900,
  },
  "Nivel 2 · 220 V 32 A · 20 → 80 %": {
    vehicle,
    charger: { current: "AC", voltageV: 220, currentA: 32, phases: 1 },
    startSocPct: 20,
    targetSocPct: 80,
    tariffPerKwh: 900,
    startAt: new Date(),
  },
  "DC 60 kW · 30 → 100 %": {
    vehicle,
    charger: { current: "DC", ratedKw: 60 },
    startSocPct: 30,
    targetSocPct: 100,
  },
  "Error: objetivo menor que el actual": {
    vehicle,
    charger: { current: "AC", voltageV: 220, currentA: 16, phases: 1 },
    startSocPct: 80,
    targetSocPct: 50,
  },
};

const tripScenarios: Record<string, TripInput> = {
  "Plano · 100 km": {
    vehicle,
    segments: [{ distanceKm: 100, durationMin: 90, ascentM: 0, descentM: 0 }],
    startSocPct: 100,
  },
  "Bogotá → Girardot (aprox.) · 4 personas, A/C, 28 °C": {
    vehicle,
    segments: [
      { distanceKm: 60, durationMin: 75, ascentM: 300, descentM: 1100 },
      { distanceKm: 75, durationMin: 70, ascentM: 200, descentM: 1700 },
    ],
    startSocPct: 90,
    passengers: 4,
    cargoKg: 40,
    airConditioning: true,
    outsideTempC: 28,
  },
  "Girardot → Bogotá (aprox.) · subida, sport": {
    vehicle,
    segments: [
      { distanceKm: 75, durationMin: 80, ascentM: 1700, descentM: 200 },
      { distanceKm: 60, durationMin: 80, ascentM: 1100, descentM: 300 },
    ],
    startSocPct: 60,
    style: "sport",
  },
};

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const time = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" });
const hm = (minutes: number) => {
  const { hours, minutes: rest } = splitDuration(minutes);
  return `${hours} h ${rest} min`;
};

const run = (title: string, fn: () => Record<string, unknown>) => {
  console.log(`\n■ ${title}`);
  try {
    console.table(fn());
  } catch (error) {
    if (!(error instanceof CalcInputError)) throw error;
    console.log(`  Error de validación en «${error.field}»: ${error.message}`);
  }
};

console.log("CARGA");
for (const [title, input] of Object.entries(chargeScenarios)) {
  run(title, () => {
    const r = estimateCharge(input);
    return {
      "Potencia efectiva (kW)": r.effectiveKw,
      "Limitado por": r.limitedBy,
      Duración: hm(r.durationMin),
      "Termina a las": r.endsAt ? time.format(r.endsAt) : "—",
      "kWh a la batería": r.batteryKwh,
      "kWh de la red": r.gridKwh,
      Costo: r.cost === null ? "sin tarifa" : cop.format(r.cost),
      "Autonomía ganada (km)": r.rangeGainedKm ?? "—",
      Avisos: r.warnings.join(", ") || "—",
    };
  });
}

console.log("\nTRAYECTO");
for (const [title, input] of Object.entries(tripScenarios)) {
  run(title, () => {
    const r = estimateTrip(input);
    return {
      "Energía (kWh)": r.energyKwh,
      "Rango energía (kWh)": `${r.energyRangeKwh.min} – ${r.energyRangeKwh.max}`,
      "% consumido": r.consumedPct,
      "% al llegar": r.arrivalSocPct,
      "Rango % al llegar": `${r.arrivalSocRangePct.min} – ${r.arrivalSocRangePct.max}`,
      "Autonomía restante (km)": r.remainingRangeKm,
      "¿Llega?": r.reachable ? "sí" : "no",
      "¿Rompe la reserva?": r.belowReserve ? `sí (< ${r.reservePct} %)` : "no",
      "Masa (kg)": r.breakdown.massKg,
      "Subida (kWh)": r.breakdown.climbKwh,
      "Regeneración (kWh)": r.breakdown.regenKwh,
    };
  });
}
