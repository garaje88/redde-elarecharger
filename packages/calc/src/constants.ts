/**
 * Tunable constants of the engine (docs/PLAN.md F1 and F2). Every calculation accepts a
 * partial override, so the app can calibrate them without changing code.
 */

export type RangeCycle = "NEDC" | "WLTP" | "EPA" | "CLTC";
export type DrivingStyle = "eco" | "normal" | "sport";

/** A factor applied while a value stays below `below`; the last band uses `below: Infinity`. */
export interface Band {
  below: number;
  factor: number;
}

/** A piecewise curve: `fraction` of the available power while the SoC stays below `belowSoc`. */
export interface CurveStep {
  belowSoc: number;
  fraction: number;
}

export interface CalcConstants {
  gravityMs2: number;
  passengerMassKg: number;
  drivetrainEfficiency: number;
  regenEfficiency: number;
  /** Real-world correction of the homologated range per test cycle. */
  cycleFactors: Record<RangeCycle, number>;
  /** By average segment speed in km/h. */
  speedBands: Band[];
  styleFactors: Record<DrivingStyle, number>;
  airConditioningFactor: number;
  /** By outside temperature in °C. */
  temperatureBands: Band[];
  /** Grid → battery efficiency. */
  chargingEfficiency: {
    /** AC at or below `lowVoltageMaxV` (110–120 V). */
    acLowVoltage: number;
    ac: number;
    dc: number;
  };
  lowVoltageMaxV: number;
  /** Fallback curves when the vehicle has none, as a fraction of the effective power. */
  defaultCurves: { ac: CurveStep[]; dc: CurveStep[] };
  /** Width of each integration step of the charge time, in SoC percentage points. */
  socStepPct: number;
  defaultReservePct: number;
  /** Results are estimates shown with this relative margin (±). */
  uncertainty: number;
  /** Above this amperage a circuit at or below `lowVoltageMaxV` is unusual. */
  lowVoltageTypicalMaxA: number;
}

export const DEFAULT_CONSTANTS: CalcConstants = {
  gravityMs2: 9.81,
  passengerMassKg: 75,
  drivetrainEfficiency: 0.9,
  regenEfficiency: 0.6,
  cycleFactors: {
    NEDC: 1.3,
    WLTP: 1.15,
    EPA: 1.0,
    // Not in the original plan: CLTC is even more optimistic than NEDC. Calibrate with real data.
    CLTC: 1.35,
  },
  speedBands: [
    { below: 50, factor: 0.9 },
    { below: 80, factor: 1.0 },
    { below: 100, factor: 1.12 },
    { below: Infinity, factor: 1.25 },
  ],
  styleFactors: { eco: 0.92, normal: 1.0, sport: 1.15 },
  airConditioningFactor: 1.06,
  temperatureBands: [
    { below: 5, factor: 1.2 },
    { below: 15, factor: 1.08 },
    // Above 28 °C the extra load comes from the A/C, covered by airConditioningFactor.
    { below: Infinity, factor: 1.0 },
  ],
  chargingEfficiency: { acLowVoltage: 0.85, ac: 0.9, dc: 0.93 },
  lowVoltageMaxV: 130,
  defaultCurves: {
    ac: [
      { belowSoc: 95, fraction: 1 },
      { belowSoc: Infinity, fraction: 0.5 },
    ],
    dc: [
      { belowSoc: 80, fraction: 1 },
      { belowSoc: 90, fraction: 0.6 },
      { belowSoc: Infinity, fraction: 0.35 },
    ],
  },
  socStepPct: 1,
  defaultReservePct: 10,
  uncertainty: 0.1,
  lowVoltageTypicalMaxA: 16,
};

/** Deep-enough merge for one level of nested objects; arrays are replaced, not merged. */
export function resolveConstants(overrides: Partial<CalcConstants> = {}): CalcConstants {
  return {
    ...DEFAULT_CONSTANTS,
    ...overrides,
    cycleFactors: { ...DEFAULT_CONSTANTS.cycleFactors, ...overrides.cycleFactors },
    styleFactors: { ...DEFAULT_CONSTANTS.styleFactors, ...overrides.styleFactors },
    chargingEfficiency: {
      ...DEFAULT_CONSTANTS.chargingEfficiency,
      ...overrides.chargingEfficiency,
    },
    defaultCurves: { ...DEFAULT_CONSTANTS.defaultCurves, ...overrides.defaultCurves },
  };
}

export function bandFactor(bands: readonly Band[], value: number): number {
  const band = bands.find((b) => value < b.below);
  return band ? band.factor : 1;
}
