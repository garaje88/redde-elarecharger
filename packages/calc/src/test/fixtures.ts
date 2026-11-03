import type { ChargeVehicle } from "../charging";
import type { TripVehicle } from "../trip";

/**
 * Example vehicle from docs/reference (Deepal S05 E-Max): 56.12 kWh LFP, 458 km NEDC,
 * 30→100 % in ~60 min. The sheet has no AC/DC power or curb weight; 1852 kg is a
 * test assumption so that car + driver = 1927 kg, the mass used in the PLAN's climb case.
 */
export const DEEPAL_S05 = {
  usableKwh: 56.12,
  rangeKm: 458,
  rangeCycle: "NEDC",
  curbWeightKg: 1852,
} as const satisfies TripVehicle & ChargeVehicle;
