import {
  type CalcConstants,
  type DrivingStyle,
  type RangeCycle,
  bandFactor,
  resolveConstants,
} from "./constants";
import { baseConsumptionKwh100km } from "./consumption";
import { CalcInputError, assertInRange, assertNonNegative, assertPositive } from "./errors";

export interface TripSegment {
  distanceKm: number;
  durationMin: number;
  ascentM: number;
  descentM: number;
}

export interface TripVehicle {
  usableKwh: number;
  curbWeightKg: number;
  consumptionKwh100km?: number | null;
  rangeKm?: number | null;
  rangeCycle?: RangeCycle | null;
  /** State of health; scales the usable capacity. Defaults to 100. */
  batteryHealthPct?: number;
}

export interface TripInput {
  vehicle: TripVehicle;
  /** One segment per routing leg; mountain routes are more accurate split in segments. */
  segments: TripSegment[];
  startSocPct: number;
  /** Occupants including the driver. Defaults to 1. */
  passengers?: number;
  cargoKg?: number;
  airConditioning?: boolean;
  style?: DrivingStyle;
  outsideTempC?: number | null;
  reservePct?: number;
}

export interface TripSegmentResult extends TripSegment {
  averageSpeedKmh: number | null;
  speedFactor: number;
  drivingKwh: number;
  climbKwh: number;
  regenKwh: number;
  energyKwh: number;
}

export interface TripResult {
  energyKwh: number;
  energyRangeKwh: { min: number; max: number };
  consumedPct: number;
  /** May be negative: the destination is not reachable with the current charge. */
  arrivalSocPct: number;
  arrivalSocRangePct: { min: number; max: number };
  remainingRangeKm: number;
  reachable: boolean;
  belowReserve: boolean;
  reservePct: number;
  /** "¿Cómo se calculó?" breakdown. */
  breakdown: {
    distanceKm: number;
    ascentM: number;
    descentM: number;
    baseConsumptionKwh100km: number;
    usableKwh: number;
    massKg: number;
    styleFactor: number;
    climateFactor: number;
    airConditioningFactor: number;
    drivingKwh: number;
    climbKwh: number;
    regenKwh: number;
  };
  segments: TripSegmentResult[];
}

const round = (value: number, decimals: number) => {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
};

function validate(input: TripInput): void {
  if (input.segments.length === 0)
    throw new CalcInputError("segments", "A trip needs at least one segment.");
  assertPositive("vehicle.usableKwh", input.vehicle.usableKwh);
  assertPositive("vehicle.curbWeightKg", input.vehicle.curbWeightKg);
  assertInRange("vehicle.batteryHealthPct", input.vehicle.batteryHealthPct ?? 100, 1, 100);
  assertInRange("startSocPct", input.startSocPct, 0, 100);
  assertInRange("passengers", input.passengers ?? 1, 0, 9);
  assertInRange("cargoKg", input.cargoKg ?? 0, 0, 2000);
  if (input.outsideTempC != null) assertInRange("outsideTempC", input.outsideTempC, -40, 60);
  if (input.reservePct != null) assertInRange("reservePct", input.reservePct, 0, 50);
  input.segments.forEach((segment, i) => {
    assertNonNegative(`segments.${i}.distanceKm`, segment.distanceKm);
    assertNonNegative(`segments.${i}.durationMin`, segment.durationMin);
    assertNonNegative(`segments.${i}.ascentM`, segment.ascentM);
    assertNonNegative(`segments.${i}.descentM`, segment.descentM);
  });
}

/**
 * F1: energy from A to B.
 * E = d/100 · c_base · f_speed · f_style · f_climate · f_AC + m·g·(H_up/η_drive − H_down·η_regen) / 3.6e6
 * computed per segment and summed.
 */
export function estimateTrip(input: TripInput, overrides?: Partial<CalcConstants>): TripResult {
  validate(input);
  const k = resolveConstants(overrides);

  const usableKwh = input.vehicle.usableKwh * ((input.vehicle.batteryHealthPct ?? 100) / 100);
  const baseConsumption = baseConsumptionKwh100km(input.vehicle, overrides);
  const massKg =
    input.vehicle.curbWeightKg + (input.passengers ?? 1) * k.passengerMassKg + (input.cargoKg ?? 0);
  const styleFactor = k.styleFactors[input.style ?? "normal"];
  const climateFactor =
    input.outsideTempC == null ? 1 : bandFactor(k.temperatureBands, input.outsideTempC);
  const airConditioningFactor = input.airConditioning ? k.airConditioningFactor : 1;
  const joulesPerKwh = 3.6e6;

  const segments = input.segments.map((segment): TripSegmentResult => {
    const averageSpeedKmh =
      segment.durationMin > 0 ? segment.distanceKm / (segment.durationMin / 60) : null;
    const speedFactor = averageSpeedKmh == null ? 1 : bandFactor(k.speedBands, averageSpeedKmh);
    const drivingKwh =
      (segment.distanceKm / 100) *
      baseConsumption *
      speedFactor *
      styleFactor *
      climateFactor *
      airConditioningFactor;
    const climbKwh =
      (massKg * k.gravityMs2 * segment.ascentM) / k.drivetrainEfficiency / joulesPerKwh;
    const regenKwh = (massKg * k.gravityMs2 * segment.descentM * k.regenEfficiency) / joulesPerKwh;
    return {
      ...segment,
      averageSpeedKmh,
      speedFactor,
      drivingKwh,
      climbKwh,
      regenKwh,
      energyKwh: drivingKwh + climbKwh - regenKwh,
    };
  });

  const sum = (pick: (s: TripSegmentResult) => number) =>
    segments.reduce((acc, s) => acc + pick(s), 0);
  const energyKwh = sum((s) => s.energyKwh);
  const consumedPct = (energyKwh / usableKwh) * 100;
  // Regeneration cannot charge beyond a full battery.
  const arrivalSocPct = Math.min(100, input.startSocPct - consumedPct);
  const reservePct = input.reservePct ?? k.defaultReservePct;

  const flatKwhPerKm =
    (baseConsumption / 100) * styleFactor * climateFactor * airConditioningFactor;
  const remainingRangeKm = Math.max(0, ((arrivalSocPct / 100) * usableKwh) / flatKwhPerKm);

  const margin = Math.abs(energyKwh) * k.uncertainty;
  const arrivalAt = (energy: number) =>
    Math.min(100, input.startSocPct - (energy / usableKwh) * 100);

  return {
    energyKwh: round(energyKwh, 3),
    energyRangeKwh: { min: round(energyKwh - margin, 3), max: round(energyKwh + margin, 3) },
    consumedPct: round(consumedPct, 2),
    arrivalSocPct: round(arrivalSocPct, 2),
    arrivalSocRangePct: {
      min: round(arrivalAt(energyKwh + margin), 2),
      max: round(arrivalAt(energyKwh - margin), 2),
    },
    remainingRangeKm: round(remainingRangeKm, 1),
    reachable: arrivalSocPct >= 0,
    belowReserve: arrivalSocPct < reservePct,
    reservePct,
    breakdown: {
      distanceKm: round(
        sum((s) => s.distanceKm),
        3,
      ),
      ascentM: round(
        sum((s) => s.ascentM),
        1,
      ),
      descentM: round(
        sum((s) => s.descentM),
        1,
      ),
      baseConsumptionKwh100km: round(baseConsumption, 3),
      usableKwh: round(usableKwh, 3),
      massKg: round(massKg, 1),
      styleFactor,
      climateFactor,
      airConditioningFactor,
      drivingKwh: round(
        sum((s) => s.drivingKwh),
        3,
      ),
      climbKwh: round(
        sum((s) => s.climbKwh),
        3,
      ),
      regenKwh: round(
        sum((s) => s.regenKwh),
        3,
      ),
    },
    segments,
  };
}
