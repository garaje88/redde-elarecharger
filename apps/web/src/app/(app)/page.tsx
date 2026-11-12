import { monthKey } from "@elacharger/calc";
import type { Vehicle } from "@elacharger/schemas";
import { ChevronLeft, ChevronRight, Camera, Route, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { BatteryPill } from "@/features/home/battery-pill";
import { MonthlyDashboard } from "@/features/home/monthly-dashboard";
import { userInitials } from "@/lib/initials";
import { getCurrentUser, getSession } from "@/server/session";
import { getMonthlySummary } from "@/server/services/sessions";
import { listVehicles } from "@/server/services/vehicles";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "noviembre 2026". */
function monthLabel(month: string) {
  const [year, mon = 1] = month.split("-").map(Number);
  return `${MONTHS[mon - 1]} ${year}`;
}

/** The month before or after ("2026-01", -1 → "2025-12"). */
function shiftMonth(month: string, months: number) {
  const [year = 0, mon = 1] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1 + months, 1)).toISOString().slice(0, 7);
}

/** "S05" from the catalog model, or the nickname for a car outside the catalog. */
const shortName = (vehicle: Vehicle) => vehicle.variant?.model ?? vehicle.nickname;

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const thisMonth = monthKey(new Date());
  // A malformed or future month falls back to the current one.
  const month =
    typeof params.month === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) &&
    params.month <= thisMonth
      ? params.month
      : thisMonth;
  const { supabase, userId } = await getSession();
  const [user, vehicles] = await Promise.all([getCurrentUser(), listVehicles(supabase, userId)]);
  const vehicle = vehicles.find((v) => v.is_default) ?? vehicles[0];
  const summary = vehicle
    ? await getMonthlySummary(supabase, userId, { vehicle: vehicle.id, month })
    : null;
  const isCurrent = month === thisMonth;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-4 pt-8 pb-6">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          {summary && (
            <nav aria-label="Mes" className="-ml-2 flex items-center">
              <Link
                href={`/?month=${shiftMonth(month, -1)}`}
                aria-label="Mes anterior"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Link>
              <span className="text-[13px] whitespace-nowrap text-muted-foreground">
                {monthLabel(month)}
              </span>
              {!isCurrent && (
                <Link
                  href={`/?month=${shiftMonth(month, 1)}`}
                  aria-label="Mes siguiente"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Link>
              )}
            </nav>
          )}
          <h1 className="font-heading text-2xl font-semibold">Tu mes</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {vehicle && summary && (
            <BatteryPill
              vehicleId={vehicle.id}
              name={shortName(vehicle)}
              battery={summary.battery}
            />
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

      {summary ? (
        <MonthlyDashboard month={summary} />
      ) : (
        <section className="flex flex-col gap-3 rounded-[20px] bg-inverse p-5 text-inverse-foreground dark:border dark:border-border">
          <h2 className="font-heading text-xl font-semibold">Agrega tu carro</h2>
          <p className="text-sm text-inverse-subtle">
            Con tu vehículo en el garaje verás aquí cuánto gastas, cuánta energía consumes y cuántos
            km recorres cada mes.
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
