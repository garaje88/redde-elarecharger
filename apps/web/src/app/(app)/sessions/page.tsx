import { dayKey, monthKey } from "@elacharger/calc";
import { SessionTotalsQuerySchema } from "@elacharger/schemas";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeleteButton } from "@/features/garage/delete-button";
import {
  cop,
  monthTitle,
  sessionDay,
  sessionSummary,
  shiftMonth,
} from "@/features/sessions/format";
import { MonthlyChart } from "@/features/sessions/monthly-chart";
import { formatNumber } from "@/lib/format";
import { getSessionStats, getSessionTotals, listSessions } from "@/server/services/sessions";
import { getProfile } from "@/server/services/profile";
import { listVehicles } from "@/server/services/vehicles";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Recargas" };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export default function SessionsPage({ searchParams }: PageProps<"/sessions">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6 md:max-w-2xl">
      <Content searchParams={searchParams} />
    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
  testId,
}: {
  label: string;
  value: string;
  detail: string;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-3.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span data-testid={testId} className="font-heading text-2xl font-semibold">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/sessions">, "searchParams">) {
  const params = await searchParams;
  const { userId, supabase } = await getSession();
  const [vehicles, profile] = await Promise.all([
    listVehicles(supabase, userId),
    getProfile(supabase, userId),
  ]);
  const vehicle =
    vehicles.find((v) => v.id === params.vehicle) ??
    vehicles.find((v) => v.is_default) ??
    vehicles[0];
  const month =
    typeof params.month === "string" && MONTH.test(params.month)
      ? params.month
      : monthKey(new Date());

  const header = (
    <header className="flex items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-[26px] font-semibold">Recargas</h1>
        <nav aria-label="Mes" className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link
            href={{
              query: { ...(vehicle ? { vehicle: vehicle.id } : {}), month: shiftMonth(month, -1) },
            }}
            aria-label="Mes anterior"
            className="flex size-9 items-center justify-center rounded-full hover:bg-muted"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Link>
          <span aria-current="date">{monthTitle(month)}</span>
          {month < monthKey(new Date()) && (
            <Link
              href={{
                query: { ...(vehicle ? { vehicle: vehicle.id } : {}), month: shiftMonth(month, 1) },
              }}
              aria-label="Mes siguiente"
              className="flex size-9 items-center justify-center rounded-full hover:bg-muted"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </nav>
      </div>
      <Link
        href="/sessions/new"
        className="flex min-h-11 items-center rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        + Registrar recarga
      </Link>
    </header>
  );

  if (!vehicle) {
    return (
      <>
        {header}
        <p className="rounded-2xl bg-card p-5 text-[15px] text-muted-foreground">
          Agrega tu carro en el garaje para registrar recargas y ver tu consumo real.
        </p>
      </>
    );
  }

  // Spending between two days; by default, the current month so far.
  const today = dayKey(new Date());
  const period = SessionTotalsQuerySchema.safeParse({
    vehicle: vehicle.id,
    from: params.from,
    to: params.to,
  });
  const range = period.success
    ? period.data
    : { vehicle: vehicle.id, from: `${today.slice(0, 7)}-01`, to: today };

  const [stats, sessions, totals] = await Promise.all([
    getSessionStats(supabase, userId, vehicle.id, month),
    listSessions(supabase, { vehicle: vehicle.id, limit: 20 }),
    getSessionTotals(supabase, userId, range),
  ]);

  return (
    <>
      {header}
      {vehicles.length > 1 && (
        <form className="flex gap-2">
          <input type="hidden" name="month" value={month} />
          <label className="flex-1">
            <span className="sr-only">Vehículo</span>
            <select
              name="vehicle"
              defaultValue={vehicle.id}
              className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-[15px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nickname}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold"
          >
            Ver
          </button>
        </form>
      )}

      <section aria-label="Estadísticas" className="grid grid-cols-2 gap-2.5">
        <StatCard
          testId="stat-consumption"
          label="Consumo real"
          value={
            stats.real_consumption_kwh_100km === null
              ? "—"
              : formatNumber(stats.real_consumption_kwh_100km, 1)
          }
          detail={`kWh/100 km${
            stats.estimated_consumption_kwh_100km === null
              ? ""
              : ` · estimado ${formatNumber(stats.estimated_consumption_kwh_100km, 1)}`
          }`}
        />
        <StatCard
          testId="stat-energy"
          label="Energía del mes"
          value={`${formatNumber(stats.month_energy_kwh, 0)} kWh`}
          detail={`en ${stats.month_sessions} ${stats.month_sessions === 1 ? "recarga" : "recargas"}`}
        />
        <StatCard
          testId="stat-km"
          label="Km recorridos"
          value={stats.month_km === null ? "—" : `${formatNumber(stats.month_km, 0)} km`}
          detail={
            stats.avg_km_between_charges === null
              ? "registra el odómetro"
              : `${formatNumber(stats.avg_km_between_charges, 0)} km entre cargas`
          }
        />
        <StatCard
          testId="stat-cost-km"
          label="Costo por km"
          value={stats.cost_per_km === null ? "—" : cop(stats.cost_per_km, stats.currency)}
          detail={
            stats.cost_per_km !== null
              ? `${cop(stats.month_cost, stats.currency)} este mes`
              : profile.tariff_per_kwh === null
                ? "configura tu tarifa en Cuenta"
                : "registra costo y odómetro"
          }
        />
      </section>

      <section
        aria-labelledby="period-title"
        className="flex flex-col gap-3 rounded-[20px] bg-card p-4"
      >
        <h2 id="period-title" className="text-sm font-semibold">
          Gasto en recargas por fechas
        </h2>
        <form className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <input type="hidden" name="vehicle" value={vehicle.id} />
          <input type="hidden" name="month" value={month} />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Desde
            <input
              type="date"
              name="from"
              defaultValue={range.from}
              max={today}
              required
              className="min-h-11 w-full rounded-xl border border-input bg-background px-2 text-[15px] text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Hasta
            <input
              type="date"
              name="to"
              defaultValue={range.to}
              required
              className="min-h-11 w-full rounded-xl border border-input bg-background px-2 text-[15px] text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Ver
          </button>
        </form>
        {!period.success && (params.from !== undefined || params.to !== undefined) && (
          <p role="alert" className="text-sm text-destructive">
            Revisa las fechas: la final no puede ser anterior a la inicial. Mostramos este mes.
          </p>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <span data-testid="period-cost" className="font-heading text-[28px] font-semibold">
            {cop(totals.cost, totals.currency)}
          </span>
          <span className="text-right text-sm text-muted-foreground">
            {totals.sessions} {totals.sessions === 1 ? "recarga" : "recargas"} ·{" "}
            {formatNumber(totals.energy_kwh, 1)} kWh
          </span>
        </div>
        {totals.sessions_without_cost > 0 && (
          <p className="text-xs text-muted-foreground">
            {totals.sessions_without_cost}{" "}
            {totals.sessions_without_cost === 1 ? "recarga no tiene" : "recargas no tienen"} costo
            registrado y no suman al total.
          </p>
        )}
      </section>

      <section aria-labelledby="monthly-title" className="rounded-[20px] bg-card p-4">
        <h2 id="monthly-title" className="mb-2 text-sm font-semibold">
          kWh cargados por mes
        </h2>
        <MonthlyChart monthly={stats.monthly} current={month} />
        <table className="sr-only">
          <caption>kWh cargados por mes</caption>
          <tbody>
            {stats.monthly.map((m) => (
              <tr key={m.month}>
                <th scope="row">{monthTitle(m.month)}</th>
                <td>{formatNumber(m.energy_kwh, 1)} kWh</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="latest-title" className="mb-4 flex flex-col gap-2">
        <h2 id="latest-title" className="text-sm font-semibold text-muted-foreground">
          Últimas recargas
        </h2>
        {sessions.items.length === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-center text-[15px] text-muted-foreground">
            Aún no registras recargas de {vehicle.nickname}.
          </p>
        ) : (
          sessions.items.map((session) => (
            <div
              key={session.id}
              className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-3"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px] font-semibold">
                  {sessionDay(session.started_at)} ·{" "}
                  {session.charger_name ?? session.location_label ?? "Recarga"}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {[
                    sessionSummary(session),
                    session.odometer_km === null
                      ? null
                      : `${formatNumber(session.odometer_km, 0)} km`,
                    session.cost === null ? null : cop(session.cost, stats.currency),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="font-heading font-semibold">
                  {session.energy_kwh === null ? "—" : `${formatNumber(session.energy_kwh, 1)} kWh`}
                </span>
                <DeleteButton
                  path={`/sessions/${session.id}`}
                  label={`recarga del ${sessionDay(session.started_at)}`}
                />
              </span>
            </div>
          ))
        )}
      </section>
    </>
  );
}
