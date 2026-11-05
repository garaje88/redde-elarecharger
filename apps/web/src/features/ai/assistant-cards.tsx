import type { AssistantCard } from "@elacharger/schemas";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { durationLabel } from "@/features/charge/explain";
import { chargeRepeatHref, tripRepeatHref } from "@/features/history/repeat-links";
import { cop } from "@/features/sessions/format";
import { formatKw, formatNumber } from "@/lib/format";

// Results the assistant got from the app's engine, shown as the app shows them. The model's
// text only repeats these numbers; the card is the source of truth.

const cardClass = "flex flex-col gap-2 rounded-2xl border border-border bg-background p-3.5";
const linkClass =
  "flex min-h-11 items-center justify-between rounded-xl bg-card px-3 text-sm font-semibold text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function Footer() {
  return <p className="text-xs text-muted-foreground">Calculado con el motor de Elacharger</p>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-[15px] font-semibold">{value}</dd>
    </div>
  );
}

export function AssistantCardView({ card }: { card: AssistantCard }) {
  if (card.kind === "trip") {
    const { trip } = card;
    return (
      <article aria-label="Resultado del trayecto" className={cardClass}>
        <p className="text-sm font-semibold">
          {trip.origin.label ?? "Origen"} → {trip.destination.label ?? "Destino"}
        </p>
        <p className="font-heading text-2xl font-semibold" data-testid="assistant-trip-arrival">
          {formatNumber(trip.start_soc, 0)} % → {formatNumber(trip.arrival_soc, 0)} %
        </p>
        <dl className="grid grid-cols-3 gap-2">
          <Stat label="Distancia" value={`${formatNumber(trip.distance_km, 0)} km`} />
          <Stat label="Tiempo" value={durationLabel(trip.duration_min)} />
          <Stat label="Consumo" value={`${formatNumber(trip.consumed_pct, 0)} %`} />
        </dl>
        {!trip.reachable ? (
          <p className="text-sm font-semibold text-destructive">No alcanzas con esa carga.</p>
        ) : trip.below_reserve ? (
          <p className="text-sm text-warning">
            Llegas por debajo de tu reserva de {formatNumber(trip.reserve_pct, 0)} %.
          </p>
        ) : null}
        <Link href={tripRepeatHref(trip)} className={linkClass}>
          Ver en Trayecto
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
        <Footer />
      </article>
    );
  }
  if (card.kind === "charge") {
    const { charge } = card;
    return (
      <article aria-label="Resultado de la carga" className={cardClass}>
        <p className="font-heading text-2xl font-semibold">
          {formatNumber(charge.start_soc, 0)} % → {formatNumber(charge.target_soc, 0)} %
        </p>
        <dl className="grid grid-cols-3 gap-2">
          <Stat label="Tiempo" value={durationLabel(charge.duration_min)} />
          <Stat label="Potencia" value={formatKw(charge.effective_kw)} />
          <Stat
            label="Costo"
            value={charge.cost === null ? "Sin tarifa" : cop(charge.cost, charge.currency)}
          />
        </dl>
        <Link href={chargeRepeatHref(charge)} className={linkClass}>
          Ver en Carga
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
        <Footer />
      </article>
    );
  }
  const { stats } = card;
  const value = (n: number | null, unit: string, decimals = 1) =>
    n === null ? "Sin datos" : `${formatNumber(n, decimals)} ${unit}`;
  return (
    <article aria-label="Tus estadísticas" className={cardClass}>
      <p className="text-sm font-semibold">Tus recargas de {stats.month}</p>
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Consumo real" value={value(stats.real_consumption_kwh_100km, "kWh/100 km")} />
        <Stat
          label="Costo por km"
          value={stats.cost_per_km === null ? "Sin datos" : cop(stats.cost_per_km, stats.currency)}
        />
        <Stat label="Entre cargas" value={value(stats.avg_km_between_charges, "km", 0)} />
        <Stat label="Recargas del mes" value={formatNumber(stats.month_sessions, 0)} />
      </dl>
      <Link href={`/sessions?vehicle=${stats.vehicle_id}`} className={linkClass}>
        Ver Recargas
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
      <Footer />
    </article>
  );
}
