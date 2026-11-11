import "server-only";
import {
  CalcInputError,
  baseConsumptionKwh100km,
  monthKey,
  periodTotals,
  sessionStats,
  weekStart,
  weeklySummary,
} from "@elacharger/calc";
import type {
  CreateSession,
  Session,
  SessionStats,
  SessionTotals,
  SessionTotalsQuery,
  UpdateSession,
  Vehicle,
  WeeklySummary,
  WeeklySummaryQuery,
} from "@elacharger/schemas";
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

/** Usable kWh today: the sheet's usable capacity scaled by the battery health. */
function usableBattery(vehicle: Vehicle): number | null {
  const usable = vehicle.spec.battery_usable_kwh;
  return usable === null ? null : usable * (vehicle.battery_health_pct / 100);
}

/** kWh/100 km the sheet implies, rounded to one decimal; null when it cannot be derived. */
function estimatedConsumption(vehicle: Vehicle): number | null {
  const { spec } = vehicle;
  if (spec.battery_usable_kwh === null) return null;
  try {
    return (
      Math.round(
        baseConsumptionKwh100km({
          usableKwh: spec.battery_usable_kwh,
          consumptionKwh100km: spec.consumption_kwh_100km,
          rangeKm: spec.range_km,
          rangeCycle: spec.range_cycle,
        }) * 10,
      ) / 10
    );
  } catch (error) {
    if (!(error instanceof CalcInputError)) throw error;
    return null;
  }
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
  const usableKwh = usableBattery(vehicle);
  const estimated = estimatedConsumption(vehicle);

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

/** Shifts a Colombian day by whole days ("2026-11-30", 1 → "2026-12-01"). */
const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** What the user spent on charging between two days; the sum comes from packages/calc. */
export async function getSessionTotals(
  db: Db,
  userId: string,
  query: SessionTotalsQuery,
): Promise<SessionTotals> {
  let request = db
    .from("charging_sessions")
    .select("started_at, energy_kwh, cost")
    // Colombia is UTC-5: a local day runs from 05:00 UTC to 05:00 UTC the next day.
    .gte("started_at", `${query.from}T05:00:00Z`)
    .lt("started_at", `${addDays(query.to, 1)}T05:00:00Z`);
  if (query.vehicle) request = request.eq("vehicle_id", query.vehicle);
  const [rows, profile] = await Promise.all([
    request,
    getProfile(db, userId),
    query.vehicle ? getVehicle(db, userId, query.vehicle) : null,
  ]);
  const totals = periodTotals(
    unwrap(rows, "Sessions").map((row) => ({
      startedAt: new Date(row.started_at),
      energyKwh: row.energy_kwh,
      cost: row.cost,
    })),
    query.from,
    query.to,
  );
  return {
    from: query.from,
    to: query.to,
    vehicle_id: query.vehicle ?? null,
    currency: profile.currency,
    sessions: totals.sessions,
    energy_kwh: totals.energyKwh,
    cost: totals.cost,
    sessions_without_cost: totals.sessionsWithoutCost,
  };
}

/** One week of a vehicle, day by day, for the home dashboard; the numbers come from packages/calc. */
export async function getWeeklySummary(
  db: Db,
  userId: string,
  query: WeeklySummaryQuery,
): Promise<WeeklySummary> {
  const start = query.week
    ? weekStart(new Date(`${query.week}T12:00:00Z`), 0)
    : weekStart(new Date());
  const [vehicle, profile, rows] = await Promise.all([
    getVehicle(db, userId, query.vehicle),
    getProfile(db, userId),
    db
      .from("charging_sessions")
      .select("started_at, energy_kwh, cost, odometer_km, start_soc, end_soc")
      .eq("vehicle_id", query.vehicle)
      .order("started_at"),
  ]);
  const sessions = unwrap(rows, "Sessions");
  const usableKwh = usableBattery(vehicle);
  const week = weeklySummary(
    sessions.map((row) => ({
      startedAt: new Date(row.started_at),
      energyKwh: row.energy_kwh,
      cost: row.cost,
      odometerKm: row.odometer_km,
      startSocPct: row.start_soc,
      endSocPct: row.end_soc,
    })),
    { weekStart: start, usableKwh },
  );
  const estimated = estimatedConsumption(vehicle);

  const last = sessions.findLast((row) => row.end_soc !== null);
  const consumption = week.realConsumptionKwh100km ?? estimated;
  const lastCharge =
    last && last.end_soc !== null
      ? {
          end_soc: last.end_soc,
          at: last.started_at,
          range_km:
            usableKwh && consumption
              ? Math.round(((last.end_soc / 100) * usableKwh * 100) / consumption)
              : null,
        }
      : null;

  return {
    vehicle_id: vehicle.id,
    week_start: week.weekStart,
    week_end: addDays(week.weekStart, 6),
    currency: profile.currency,
    days: week.days.map((d) => ({ day: d.day, cost: d.cost, energy_kwh: d.energyKwh, km: d.km })),
    totals: { cost: week.totals.cost, energy_kwh: week.totals.energyKwh, km: week.totals.km },
    previous: {
      cost: week.previous.cost,
      energy_kwh: week.previous.energyKwh,
      km: week.previous.km,
    },
    real_consumption_kwh_100km: week.realConsumptionKwh100km,
    estimated_consumption_kwh_100km: estimated,
    cost_per_km: week.costPerKm,
    km_per_day: week.kmPerDay,
    last_charge: lastCharge,
  };
}
