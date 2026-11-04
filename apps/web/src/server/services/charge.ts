import "server-only";
import {
  type ChargeCalculation,
  type ChargeEstimate,
  ChargeEstimateSchema,
  type ChargeRequest,
} from "@elacharger/schemas";
import type { Json } from "@elacharger/types";
import { estimateForSetup } from "@/features/charge/estimate";
import { type Db, check, unwrap } from "../db";
import { getCharger } from "./chargers";
import { getProfile } from "./profile";
import { getVehicle } from "./vehicles";

/** F2 estimate from the user's own vehicle and charger; the server never trusts client numbers. */
export async function estimateChargeFor(
  db: Db,
  userId: string,
  request: ChargeRequest,
): Promise<ChargeEstimate> {
  const [vehicle, charger, profile] = await Promise.all([
    getVehicle(db, userId, request.vehicle_id),
    getCharger(db, request.charger_id),
    getProfile(db, userId),
  ]);
  return estimateForSetup({
    vehicle,
    charger,
    startSoc: request.start_soc,
    targetSoc: request.target_soc,
    ...(request.start_at ? { startAt: new Date(request.start_at) } : {}),
    tariffPerKwh: profile.tariff_per_kwh,
    currency: profile.currency,
  });
}

/** Saves the estimate and remembers the charger as the user's last one. */
export async function saveChargeCalculation(
  db: Db,
  userId: string,
  request: ChargeRequest,
): Promise<ChargeCalculation> {
  const estimate = await estimateChargeFor(db, userId, request);
  const row = unwrap(
    await db
      .from("charge_calculations")
      .insert({
        user_id: userId,
        vehicle_id: estimate.vehicle_id,
        charger_id: estimate.charger_id,
        start_soc: estimate.start_soc,
        target_soc: estimate.target_soc,
        effective_kw: estimate.effective_kw,
        energy_grid_kwh: estimate.grid_kwh,
        duration_min: estimate.duration_min,
        cost: estimate.cost,
        // The full estimate, so the history shows what the user saw even if the car changes.
        inputs: { estimate } as unknown as NonNullable<Json>,
        engine_version: estimate.engine_version,
      })
      .select("id, created_at")
      .single(),
    "Charge calculation",
  );
  check(
    await db.from("profiles").update({ default_charger_id: estimate.charger_id }).eq("id", userId),
    "Profile",
  );
  return { ...estimate, id: row.id, created_at: row.created_at };
}

export async function listChargeCalculations(db: Db): Promise<ChargeCalculation[]> {
  const rows = unwrap(
    await db
      .from("charge_calculations")
      .select("id, created_at, inputs")
      .order("created_at", { ascending: false })
      .limit(50),
    "Charge calculations",
  );
  return rows.flatMap((row) => {
    const parsed = ChargeEstimateSchema.safeParse((row.inputs as { estimate?: unknown }).estimate);
    return parsed.success ? [{ ...parsed.data, id: row.id, created_at: row.created_at }] : [];
  });
}
