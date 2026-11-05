import "server-only";
import { CalcInputError, baseConsumptionKwh100km, monthKey, sessionStats } from "@elacharger/calc";
import type { CreateSession, Session, SessionStats, UpdateSession } from "@elacharger/schemas";
import { type Db, unwrap } from "../db";
import { notFound } from "../http";
import { getCharger } from "./chargers";
import { getProfile } from "./profile";
import { getVehicle } from "./vehicles";

const SESSION_SELECT = `
  id, vehicle_id, charger_id, started_at, ended_at, start_soc, end_soc, energy_kwh, cost,
  odometer_km, location_label, notes, created_at,
  vehicle:vehicles(nickname), charger:chargers(name)
`;

interface SessionRow extends Omit<Session, "vehicle_nickname" | "charger_name"> {
  vehicle: { nickname: string } | null;
  charger: { name: string } | null;
}

function toSession({ vehicle, charger, ...row }: SessionRow): Session {
  return {
    ...row,
    vehicle_nickname: vehicle?.nickname ?? null,
    charger_name: charger?.name ?? null,
  };
}

/** Linked records must be the user's own; RLS would refuse them, this answers 404 instead. */
async function checkLinks(
  db: Db,
  userId: string,
  input: { vehicle_id?: string | null; charger_id?: string | null },
) {
  await Promise.all([
    input.vehicle_id ? getVehicle(db, userId, input.vehicle_id) : null,
    input.charger_id ? getCharger(db, input.charger_id) : null,
  ]);
}

export async function listSessions(
  db: Db,
  options: { vehicle?: string; before?: string; limit: number },
): Promise<{ items: Session[]; next_cursor: string | null }> {
  let query = db
    .from("charging_sessions")
    .select(SESSION_SELECT)
    .order("started_at", { ascending: false })
    .limit(options.limit + 1);
  if (options.vehicle) query = query.eq("vehicle_id", options.vehicle);
  if (options.before) query = query.lt("started_at", options.before);
  const rows = (unwrap(await query, "Sessions") as unknown as SessionRow[]).map(toSession);
  const page = rows.slice(0, options.limit);
  return {
    items: page,
    next_cursor: rows.length > options.limit ? (page.at(-1)?.started_at ?? null) : null,
  };
}

export async function getChargingSession(db: Db, id: string): Promise<Session> {
  const row = unwrap(
    await db.from("charging_sessions").select(SESSION_SELECT).eq("id", id).maybeSingle(),
    "Session",
  );
  return toSession(row as unknown as SessionRow);
}

export async function createSession(
  db: Db,
  userId: string,
  input: CreateSession,
): Promise<Session> {
  await checkLinks(db, userId, input);
  let { cost } = input;
  if (cost === null && input.energy_kwh !== null) {
    // No cost given: the user's tariff, when they set one.
    const { tariff_per_kwh } = await getProfile(db, userId);
    if (tariff_per_kwh !== null) cost = Math.round(input.energy_kwh * tariff_per_kwh * 100) / 100;
  }
  const created = unwrap(
    await db
      .from("charging_sessions")
      .insert({ ...input, cost, user_id: userId })
      .select("id")
      .single(),
    "Session",
  );
  return getChargingSession(db, created.id);
}

export async function updateSession(
  db: Db,
  userId: string,
  id: string,
  input: UpdateSession,
): Promise<Session> {
  await checkLinks(db, userId, input);
  if (Object.keys(input).length > 0) {
    const updated = unwrap(
      await db.from("charging_sessions").update(input).eq("id", id).select("id"),
      "Session",
    );
    if (updated.length === 0) throw notFound("The session does not exist.");
  }
  return getChargingSession(db, id);
}

export async function deleteSession(db: Db, id: string): Promise<void> {
  const deleted = unwrap(
    await db.from("charging_sessions").delete().eq("id", id).select("id"),
    "Session",
  );
  if (deleted.length === 0) throw notFound("The session does not exist.");
}

export async function getSessionStats(
  db: Db,
  userId: string,
  vehicleId: string,
  month: string = monthKey(new Date()),
): Promise<SessionStats> {
  const [vehicle, profile, rows] = await Promise.all([
    getVehicle(db, userId, vehicleId),
    getProfile(db, userId),
    db
      .from("charging_sessions")
      .select("started_at, energy_kwh, cost, odometer_km, start_soc, end_soc")
      .eq("vehicle_id", vehicleId)
      .order("started_at"),
  ]);
  const { spec } = vehicle;
  const usableKwh =
    spec.battery_usable_kwh === null
      ? null
      : spec.battery_usable_kwh * (vehicle.battery_health_pct / 100);

  let estimated: number | null = null;
  if (spec.battery_usable_kwh !== null) {
    try {
      estimated =
        Math.round(
          baseConsumptionKwh100km({
            usableKwh: spec.battery_usable_kwh,
            consumptionKwh100km: spec.consumption_kwh_100km,
            rangeKm: spec.range_km,
            rangeCycle: spec.range_cycle,
          }) * 10,
        ) / 10;
    } catch (error) {
      if (!(error instanceof CalcInputError)) throw error;
    }
  }

  const stats = sessionStats(
    unwrap(rows, "Sessions").map((row) => ({
      startedAt: new Date(row.started_at),
      energyKwh: row.energy_kwh,
      cost: row.cost,
      odometerKm: row.odometer_km,
      startSocPct: row.start_soc,
      endSocPct: row.end_soc,
    })),
    { usableKwh, month },
  );

  return {
    vehicle_id: vehicle.id,
    month,
    currency: profile.currency,
    real_consumption_kwh_100km: stats.realConsumptionKwh100km,
    estimated_consumption_kwh_100km: estimated,
    cost_per_km: stats.costPerKm,
    avg_km_between_charges: stats.avgKmBetweenCharges,
    month_km: stats.monthKm,
    month_energy_kwh: stats.monthEnergyKwh,
    month_sessions: stats.monthSessions,
    month_cost: stats.monthCost,
    monthly: stats.monthly.map((m) => ({
      month: m.month,
      energy_kwh: m.energyKwh,
      cost: m.cost,
      sessions: m.sessions,
    })),
  };
}
