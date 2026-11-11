import { assertNonNegative } from "./errors";

// Real-world statistics from logged charging sessions (docs/PLAN.md phase 6).

export interface SessionRecord {
  startedAt: Date;
  /** kWh delivered by the charger (grid side), when known. */
  energyKwh?: number | null;
  cost?: number | null;
  odometerKm?: number | null;
  startSocPct?: number | null;
  endSocPct?: number | null;
}

export interface StatsOptions {
  /** Usable battery, so SoC deltas can be turned into kWh (battery side). */
  usableKwh?: number | null;
  /** Month to summarize, "YYYY-MM" in local time. */
  month: string;
  /** How many months the chart covers, ending at `month`. */
  months?: number;
  /** Local time offset in minutes; Colombia is UTC−5 all year. */
  utcOffsetMin?: number;
}

export interface MonthlyTotal {
  month: string;
  energyKwh: number;
  cost: number;
  sessions: number;
}

export interface SessionStats {
  /** kWh/100 km measured between charges; null without two odometer readings. */
  realConsumptionKwh100km: number | null;
  costPerKm: number | null;
  avgKmBetweenCharges: number | null;
  /** Km between the charges that fall in `month`. */
  monthKm: number | null;
  monthEnergyKwh: number;
  monthSessions: number;
  monthCost: number;
  monthly: MonthlyTotal[];
}

const round = (value: number, decimals: number) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

/** "YYYY-MM" of a date in local time. */
export function monthKey(date: Date, utcOffsetMin = -300): string {
  const local = new Date(date.getTime() + utcOffsetMin * 60_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousMonths(month: string, count: number): string[] {
  const [year = 0, mon = 1] = month.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, mon - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * Energy used between two charges: from the SoC drop when both readings and the battery size
 * are known (battery side, comparable with the trip estimate), otherwise the kWh of the next
 * charge (grid side, includes charging losses).
 */
function energyBetween(
  previous: SessionRecord,
  current: SessionRecord,
  usableKwh: number | null | undefined,
) {
  if (
    usableKwh &&
    previous.endSocPct != null &&
    current.startSocPct != null &&
    previous.endSocPct > current.startSocPct
  ) {
    return ((previous.endSocPct - current.startSocPct) / 100) * usableKwh;
  }
  return current.energyKwh ?? null;
}

/** Statistics for one vehicle's sessions. */
export function sessionStats(
  sessions: readonly SessionRecord[],
  options: StatsOptions,
): SessionStats {
  const offset = options.utcOffsetMin ?? -300;
  for (const [i, s] of sessions.entries()) {
    if (s.energyKwh != null) assertNonNegative(`sessions.${i}.energyKwh`, s.energyKwh);
    if (s.cost != null) assertNonNegative(`sessions.${i}.cost`, s.cost);
    if (s.odometerKm != null) assertNonNegative(`sessions.${i}.odometerKm`, s.odometerKm);
  }

  // Consecutive charges with growing odometer readings define the distance driven.
  const withOdometer = sessions
    .filter((s) => s.odometerKm != null)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  let km = 0;
  let energy = 0;
  let energyKm = 0;
  let cost = 0;
  let costKm = 0;
  let intervals = 0;
  let monthKm = 0;
  let monthIntervals = 0;
  for (let i = 1; i < withOdometer.length; i++) {
    const previous = withOdometer[i - 1] as SessionRecord;
    const current = withOdometer[i] as SessionRecord;
    const driven = (current.odometerKm as number) - (previous.odometerKm as number);
    if (driven <= 0) continue;
    km += driven;
    intervals++;
    if (monthKey(current.startedAt, offset) === options.month) {
      monthKm += driven;
      monthIntervals++;
    }
    const used = energyBetween(previous, current, options.usableKwh);
    if (used != null) {
      energy += used;
      energyKm += driven;
    }
    if (current.cost != null) {
      cost += current.cost;
      costKm += driven;
    }
  }

  const months = previousMonths(options.month, options.months ?? 6);
  const monthly = new Map(months.map((m) => [m, { month: m, energyKwh: 0, cost: 0, sessions: 0 }]));
  for (const s of sessions) {
    const bucket = monthly.get(monthKey(s.startedAt, offset));
    if (!bucket) continue;
    bucket.energyKwh += s.energyKwh ?? 0;
    bucket.cost += s.cost ?? 0;
    bucket.sessions++;
  }
  const current = monthly.get(options.month) as MonthlyTotal;

  return {
    realConsumptionKwh100km: energyKm > 0 ? round((energy / energyKm) * 100, 1) : null,
    costPerKm: costKm > 0 ? round(cost / costKm, 1) : null,
    avgKmBetweenCharges: intervals > 0 ? round(km / intervals, 0) : null,
    monthKm: monthIntervals > 0 ? round(monthKm, 0) : null,
    monthEnergyKwh: round(current.energyKwh, 1),
    monthSessions: current.sessions,
    monthCost: round(current.cost, 0),
    monthly: [...monthly.values()].map((m) => ({
      ...m,
      energyKwh: round(m.energyKwh, 1),
      cost: round(m.cost, 0),
    })),
  };
}

export interface PeriodTotals {
  sessions: number;
  energyKwh: number;
  cost: number;
  /** Sessions in the period without a cost; the total leaves them out. */
  sessionsWithoutCost: number;
}

/** Local calendar day "YYYY-MM-DD" of a date (Colombia by default). */
export function dayKey(date: Date, utcOffsetMin = -300): string {
  return new Date(date.getTime() + utcOffsetMin * 60_000).toISOString().slice(0, 10);
}

/** Totals of the sessions started between two local days, both included. */
export function periodTotals(
  sessions: SessionRecord[],
  from: string,
  to: string,
  utcOffsetMin = -300,
): PeriodTotals {
  const inPeriod = sessions.filter((s) => {
    const day = dayKey(s.startedAt, utcOffsetMin);
    return day >= from && day <= to;
  });
  let energy = 0;
  let cost = 0;
  let withoutCost = 0;
  for (const s of inPeriod) {
    if (s.energyKwh != null) {
      assertNonNegative("energyKwh", s.energyKwh);
      energy += s.energyKwh;
    }
    if (s.cost != null) {
      assertNonNegative("cost", s.cost);
      cost += s.cost;
    } else {
      withoutCost += 1;
    }
  }
  return {
    sessions: inPeriod.length,
    energyKwh: round(energy, 2),
    cost: round(cost, 2),
    sessionsWithoutCost: withoutCost,
  };
}

export interface WeekDay {
  /** Local day "YYYY-MM-DD". */
  day: string;
  cost: number;
  /** Energy used on the trips that end at this day's charge (see `energyBetween`). */
  energyKwh: number;
  /** Km driven since the previous charge, counted on the day of the charge. */
  km: number;
}

export interface WeekTotals {
  cost: number;
  energyKwh: number;
  km: number;
}

export interface WeeklySummary {
  /** Monday of the week, local time. */
  weekStart: string;
  /** Monday to Sunday. */
  days: WeekDay[];
  totals: WeekTotals;
  previous: WeekTotals;
  /** Measured kWh/100 km this week; null without a km with known energy. */
  realConsumptionKwh100km: number | null;
  costPerKm: number | null;
  kmPerDay: number;
}

const shiftDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Monday "YYYY-MM-DD" of the local week that contains `date`. */
export function weekStart(date: Date, utcOffsetMin = -300): string {
  const day = dayKey(date, utcOffsetMin);
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return shiftDay(day, -weekday);
}

/**
 * One week of a vehicle's sessions, day by day, and the week before for comparison. Cost is
 * counted on the day of each charge; km and energy come from the interval between consecutive
 * odometer readings and are counted on the day of the charge that closes it.
 */
export function weeklySummary(
  sessions: readonly SessionRecord[],
  options: { weekStart: string; usableKwh?: number | null; utcOffsetMin?: number },
): WeeklySummary {
  const offset = options.utcOffsetMin ?? -300;
  const start = options.weekStart;
  const previousStart = shiftDay(start, -7);
  const days = Array.from({ length: 7 }, (_, i) => ({
    day: shiftDay(start, i),
    cost: 0,
    energyKwh: 0,
    km: 0,
  }));
  const byDay = new Map(days.map((d) => [d.day, d]));
  const previous: WeekTotals = { cost: 0, energyKwh: 0, km: 0 };
  const inPrevious = (day: string) => day >= previousStart && day < start;

  for (const [i, s] of sessions.entries()) {
    if (s.cost == null) continue;
    assertNonNegative(`sessions.${i}.cost`, s.cost);
    const day = dayKey(s.startedAt, offset);
    const bucket = byDay.get(day);
    if (bucket) bucket.cost += s.cost;
    else if (inPrevious(day)) previous.cost += s.cost;
  }

  const withOdometer = sessions
    .filter((s) => s.odometerKm != null)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  let energyKm = 0;
  let energy = 0;
  let costKm = 0;
  let costOfKm = 0;
  for (let i = 1; i < withOdometer.length; i++) {
    const before = withOdometer[i - 1] as SessionRecord;
    const current = withOdometer[i] as SessionRecord;
    const driven = (current.odometerKm as number) - (before.odometerKm as number);
    if (driven <= 0) continue;
    const day = dayKey(current.startedAt, offset);
    const used = energyBetween(before, current, options.usableKwh);
    const bucket = byDay.get(day);
    if (bucket) {
      bucket.km += driven;
      if (used != null) {
        bucket.energyKwh += used;
        energy += used;
        energyKm += driven;
      }
      if (current.cost != null) {
        costOfKm += current.cost;
        costKm += driven;
      }
    } else if (inPrevious(day)) {
      previous.km += driven;
      previous.energyKwh += used ?? 0;
    }
  }

  const rounded = days.map((d) => ({
    day: d.day,
    cost: round(d.cost, 0),
    energyKwh: round(d.energyKwh, 1),
    km: round(d.km, 0),
  }));
  const sum = (key: keyof WeekTotals) => days.reduce((total, d) => total + d[key], 0);
  const totalKm = sum("km");
  return {
    weekStart: start,
    days: rounded,
    totals: {
      cost: round(sum("cost"), 0),
      energyKwh: round(sum("energyKwh"), 1),
      km: round(totalKm, 0),
    },
    previous: {
      cost: round(previous.cost, 0),
      energyKwh: round(previous.energyKwh, 1),
      km: round(previous.km, 0),
    },
    realConsumptionKwh100km: energyKm > 0 ? round((energy / energyKm) * 100, 1) : null,
    costPerKm: costKm > 0 ? round(costOfKm / costKm, 1) : null,
    kmPerDay: round(totalKm / 7, 0),
  };
}
