import { type CalcConstants, type RangeCycle, resolveConstants } from "./constants";
import { baseConsumptionKwh100km } from "./consumption";
import { type ChargeCurvePoint, curvePowerKw, normalizeCurve, stepFraction } from "./curves";
import { CalcInputError, assertInRange, assertNonNegative, assertPositive } from "./errors";

export interface AcChargerInput {
  current: "AC";
  voltageV: number;
  /** Amperage of the circuit (or the charger setting, whichever is lower). */
  currentA: number;
  phases: 1 | 3;
  /** Nominal power of the wallbox or portable charger, when known. */
  ratedKw?: number | null;
  /** Overrides the default grid → battery efficiency. */
  efficiency?: number | null;
}

export interface DcChargerInput {
  current: "DC";
  ratedKw: number;
  efficiency?: number | null;
}

export type ChargerInput = AcChargerInput | DcChargerInput;

export interface ChargeVehicle {
  usableKwh: number;
  batteryHealthPct?: number;
  /** null = unknown ("Por confirmar"); the calculation then ignores that limit. */
  acOnboardKw?: number | null;
  dcMaxKw?: number | null;
  /** DC curve of the vehicle; the default curve is used when absent. */
  chargeCurve?: ChargeCurvePoint[] | null;
  consumptionKwh100km?: number | null;
  rangeKm?: number | null;
  rangeCycle?: RangeCycle | null;
}

export interface ChargeInput {
  vehicle: ChargeVehicle;
  charger: ChargerInput;
  startSocPct: number;
  targetSocPct: number;
  /** Price per kWh taken from the grid (COP); no cost is returned without it. */
  tariffPerKwh?: number | null;
  /** When given, the result includes the estimated end time. */
  startAt?: Date;
}

export type PowerLimit = "circuit" | "charger" | "onboard_charger" | "vehicle_dc";

export type ChargeWarning =
  "onboard_charger_unknown" | "vehicle_dc_max_unknown" | "low_voltage_high_amperage";

export interface ChargePoint {
  minute: number;
  socPct: number;
  powerKw: number;
}

export interface ChargeResult {
  /** Power drawn from the grid before charging losses. */
  gridPowerKw: number;
  /** Power reaching the battery (grid power × efficiency) before the curve taper. */
  effectiveKw: number;
  limitedBy: PowerLimit;
  efficiency: number;
  durationMin: number;
  endsAt: Date | null;
  batteryKwh: number;
  gridKwh: number;
  cost: number | null;
  rangeGainedKm: number | null;
  /** SoC vs time for the chart, one point per integration step. */
  curve: ChargePoint[];
  warnings: ChargeWarning[];
}

const round = (value: number, decimals: number) => {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
};

function validate(input: ChargeInput): void {
  assertPositive("vehicle.usableKwh", input.vehicle.usableKwh);
  assertInRange("vehicle.batteryHealthPct", input.vehicle.batteryHealthPct ?? 100, 1, 100);
  if (input.vehicle.acOnboardKw != null)
    assertPositive("vehicle.acOnboardKw", input.vehicle.acOnboardKw);
  if (input.vehicle.dcMaxKw != null) assertPositive("vehicle.dcMaxKw", input.vehicle.dcMaxKw);
  assertInRange("startSocPct", input.startSocPct, 0, 100);
  assertInRange("targetSocPct", input.targetSocPct, 0, 100);
  if (input.targetSocPct <= input.startSocPct) {
    throw new CalcInputError(
      "targetSocPct",
      "The target charge must be greater than the current charge.",
    );
  }
  if (input.tariffPerKwh != null) assertNonNegative("tariffPerKwh", input.tariffPerKwh);

  const { charger } = input;
  if (charger.efficiency != null) assertInRange("charger.efficiency", charger.efficiency, 0.01, 1);
  if (charger.current === "AC") {
    assertInRange("charger.voltageV", charger.voltageV, 100, 1000);
    assertInRange("charger.currentA", charger.currentA, 1, 500);
    if (charger.phases !== 1 && charger.phases !== 3) {
      throw new CalcInputError("charger.phases", "Phases must be 1 or 3.");
    }
    if (charger.ratedKw != null) assertPositive("charger.ratedKw", charger.ratedKw);
  } else {
    assertPositive("charger.ratedKw", charger.ratedKw);
  }
}

/** Smallest of the candidate limits; unknown (null) limits are skipped. */
function minLimit(candidates: [PowerLimit, number | null | undefined][]): {
  kw: number;
  by: PowerLimit;
} {
  let best: { kw: number; by: PowerLimit } | null = null;
  for (const [by, kw] of candidates) {
    if (kw != null && (best === null || kw < best.kw)) best = { kw, by };
  }
  /* c8 ignore next */
  if (!best) throw new Error("No power limit available.");
  return best;
}

/**
 * Effective AC power: min(V·I·k_phases/1000, charger, on-board charger), with k = 1 (single
 * phase) or √3 (three phase, V line-to-line).
 */
export function acPowerKw(charger: AcChargerInput, onboardKw?: number | null) {
  const circuitKw =
    (charger.voltageV * charger.currentA * (charger.phases === 3 ? Math.sqrt(3) : 1)) / 1000;
  return minLimit([
    ["circuit", circuitKw],
    ["charger", charger.ratedKw],
    ["onboard_charger", onboardKw],
  ]);
}

/** Effective DC power: min(charger, vehicle DC max). */
export function dcPowerKw(charger: DcChargerInput, vehicleDcMaxKw?: number | null) {
  return minLimit([
    ["charger", charger.ratedKw],
    ["vehicle_dc", vehicleDcMaxKw],
  ]);
}

/**
 * F2: time to go from startSocPct to targetSocPct, integrated in steps of socStepPct because
 * the power tapers near 100 %: t = Σ (C/100) / (min(P_ef, P_curve(s)) · η).
 */
export function estimateCharge(
  input: ChargeInput,
  overrides?: Partial<CalcConstants>,
): ChargeResult {
  validate(input);
  const k = resolveConstants(overrides);
  const { vehicle, charger } = input;
  const warnings: ChargeWarning[] = [];

  const usableKwh = vehicle.usableKwh * ((vehicle.batteryHealthPct ?? 100) / 100);
  let power: { kw: number; by: PowerLimit };
  let efficiency: number;
  let powerAt: (socPct: number) => number;

  if (charger.current === "AC") {
    power = acPowerKw(charger, vehicle.acOnboardKw);
    efficiency =
      charger.efficiency ??
      (charger.voltageV <= k.lowVoltageMaxV
        ? k.chargingEfficiency.acLowVoltage
        : k.chargingEfficiency.ac);
    if (vehicle.acOnboardKw == null) warnings.push("onboard_charger_unknown");
    if (charger.voltageV <= k.lowVoltageMaxV && charger.currentA > k.lowVoltageTypicalMaxA) {
      warnings.push("low_voltage_high_amperage");
    }
    const steps = k.defaultCurves.ac;
    powerAt = (soc) => power.kw * stepFraction(steps, soc);
  } else {
    power = dcPowerKw(charger, vehicle.dcMaxKw);
    efficiency = charger.efficiency ?? k.chargingEfficiency.dc;
    if (vehicle.dcMaxKw == null) warnings.push("vehicle_dc_max_unknown");
    if (vehicle.chargeCurve && vehicle.chargeCurve.length > 0) {
      const curve = normalizeCurve(vehicle.chargeCurve);
      powerAt = (soc) => Math.min(power.kw, curvePowerKw(curve, soc));
    } else {
      const steps = k.defaultCurves.dc;
      powerAt = (soc) => power.kw * stepFraction(steps, soc);
    }
  }

  let hours = 0;
  const curve: ChargePoint[] = [
    { minute: 0, socPct: input.startSocPct, powerKw: round(powerAt(input.startSocPct), 2) },
  ];
  let soc = input.startSocPct;
  while (soc < input.targetSocPct) {
    // Align steps to multiples of socStepPct so partial first/last steps are handled.
    const next = Math.min(
      input.targetSocPct,
      (Math.floor(soc / k.socStepPct + 1e-9) + 1) * k.socStepPct,
    );
    const stepKwh = (usableKwh * (next - soc)) / 100;
    hours += stepKwh / (powerAt(soc) * efficiency);
    soc = next;
    curve.push({
      minute: round(hours * 60, 2),
      socPct: round(soc, 2),
      powerKw: round(powerAt(soc), 2),
    });
  }

  const batteryKwh = (usableKwh * (input.targetSocPct - input.startSocPct)) / 100;
  const gridKwh = batteryKwh / efficiency;
  const durationMin = hours * 60;

  let rangeGainedKm: number | null = null;
  try {
    rangeGainedKm = round(batteryKwh / (baseConsumptionKwh100km(vehicle, overrides) / 100), 1);
  } catch (error) {
    if (!(error instanceof CalcInputError)) throw error;
  }

  return {
    gridPowerKw: round(power.kw, 3),
    effectiveKw: round(power.kw * efficiency, 3),
    limitedBy: power.by,
    efficiency,
    durationMin: round(durationMin, 1),
    endsAt: input.startAt ? new Date(input.startAt.getTime() + durationMin * 60_000) : null,
    batteryKwh: round(batteryKwh, 3),
    gridKwh: round(gridKwh, 3),
    cost: input.tariffPerKwh == null ? null : round(gridKwh * input.tariffPerKwh, 2),
    rangeGainedKm,
    curve,
    warnings,
  };
}

/** Splits minutes into whole hours and minutes for display (e.g. 340 → 5 h 40 min). */
export function splitDuration(totalMinutes: number): { hours: number; minutes: number } {
  assertNonNegative("totalMinutes", totalMinutes);
  const rounded = Math.round(totalMinutes);
  return { hours: Math.floor(rounded / 60), minutes: rounded % 60 };
}
