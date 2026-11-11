import { weekStart } from "@elacharger/calc";
import type { Vehicle } from "@elacharger/schemas";
import { ChevronLeft, ChevronRight, Camera, Route, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { BatteryPill } from "@/features/home/battery-pill";
import { WeeklyDashboard } from "@/features/home/weekly-dashboard";
import { userInitials } from "@/lib/initials";
import { getCurrentUser, getSession } from "@/server/session";
import { getWeeklySummary } from "@/server/services/sessions";
import { listVehicles } from "@/server/services/vehicles";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "Semana del 9 al 15 de nov", or "del 30 de nov al 6 de dic" across months. */
function weekLabel(start: string, end: string) {
  const [, startMonth = 1, startDay = 1] = start.split("-").map(Number);
  const [, endMonth = 1, endDay = 1] = end.split("-").map(Number);
  const month = (m: number) => MONTHS[m - 1];
  return startMonth === endMonth
    ? `Semana del ${startDay} al ${endDay} de ${month(endMonth)}`
    : `Semana del ${startDay} de ${month(startMonth)} al ${endDay} de ${month(endMonth)}`;
}

/** "S05" from the catalog model, or the nickname for a car outside the catalog. */
const shortName = (vehicle: Vehicle) => vehicle.variant?.model ?? vehicle.nickname;

/** Monday of the week before or after ("2026-11-09", -1 → "2026-11-02"). */
const shiftWeek = (monday: string, weeks: number) =>
  new Date(Date.parse(`${monday}T12:00:00Z`) + weeks * 7 * 86_400_000).toISOString().slice(0, 10);

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const requested = typeof params.week === "string" ? params.week : undefined;
  const thisWeek = weekStart(new Date());
  // A malformed or future week falls back to the current one.
  const weekParam =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= thisWeek
      ? requested
      : undefined;
  const { supabase, userId } = await getSession();
  const [user, vehicles] = await Promise.all([getCurrentUser(), listVehicles(supabase, userId)]);
  const vehicle = vehicles.find((v) => v.is_default) ?? vehicles[0];
  const week = vehicle
    ? await getWeeklySummary(supabase, userId, { vehicle: vehicle.id, week: weekParam })
    : null;
  const isCurrent = week?.week_start === thisWeek;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-4 pt-8 pb-6">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          {week && (
            <nav aria-label="Semana" className="-ml-2 flex items-center">
              <Link
                href={`/?week=${shiftWeek(week.week_start, -1)}`}
                aria-label="Semana anterior"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Link>
              <span className="text-[13px] text-muted-foreground">
                {weekLabel(week.week_start, week.week_end)}
              </span>
              {!isCurrent && (
                <Link
                  href={`/?week=${shiftWeek(week.week_start, 1)}`}
                  aria-label="Semana siguiente"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Link>
              )}
            </nav>
          )}
          <h1 className="font-heading text-2xl font-semibold">Tu semana</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {vehicle && week && (
            <BatteryPill vehicleId={vehicle.id} name={shortName(vehicle)} battery={week.battery} />
          )}
          <Link
            href="/settings"
            className="flex size-11 items-center justify-center rounded-full bg-inverse font-heading text-sm font-semibold text-inverse-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:border dark:border-border"
          >
            {/* Initials are decoration: the name must contain what is read aloud (WCAG 2.5.3). */}
            <span aria-hidden="true">{userInitials(user.name, user.email)}</span>
            <span className="sr-only">Tu cuenta</span>
          </Link>
        </div>
      </header>

      {week ? (
        <WeeklyDashboard week={week} />
      ) : (
        <section className="flex flex-col gap-3 rounded-[20px] bg-inverse p-5 text-inverse-foreground dark:border dark:border-border">
          <h2 className="font-heading text-xl font-semibold">Agrega tu carro</h2>
          <p className="text-sm text-inverse-subtle">
            Con tu vehículo en el garaje verás aquí cuánto gastas, cuánta energía consumes y cuántos
            km recorres cada semana.
          </p>
          <Link
            href="/garage"
            className="flex min-h-11 items-center justify-center rounded-xl bg-brand-bright text-sm font-semibold text-inverse focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Ir al garaje
          </Link>
        </section>
      )}

      <nav aria-label="Acciones" className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/trip"
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Route aria-hidden="true" className="size-5" strokeWidth={1.75} />
            Planear viaje
          </Link>
          <Link
            href="/charge"
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-inverse text-[15px] font-semibold text-inverse-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:border dark:border-border"
          >
            <Zap aria-hidden="true" className="size-5 text-brand-bright" strokeWidth={1.75} />
            Calcular carga
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/sessions/new"
            className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-input bg-card text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Camera aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            Registrar recarga
          </Link>
          <Link
            href="/assistant"
            className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-input bg-card text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Sparkles aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            Preguntar a la IA
          </Link>
        </div>
      </nav>

      <Link
        href="/acerca"
        className="mt-2 text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        Acerca de y fuentes de datos
      </Link>
    </main>
  );
}
