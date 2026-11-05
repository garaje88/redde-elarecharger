import { Route as RouteIcon, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { durationLabel } from "@/features/charge/explain";
import { DeleteButton } from "@/features/garage/delete-button";
import { chargeRepeatHref, tripRepeatHref } from "@/features/history/repeat-links";
import { cop, sessionDay } from "@/features/sessions/format";
import { formatNumber } from "@/lib/format";
import { listChargeCalculations } from "@/server/services/charge";
import { listTripCalculations } from "@/server/services/trip";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Historial" };

export default function HistoryPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6 md:max-w-2xl">
      <h1 className="font-heading text-[26px] font-semibold">Historial</h1>
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-[20px] bg-muted" />}
      >
        <Content />
      </Suspense>
    </main>
  );
}

interface Item {
  id: string;
  kind: "trip" | "charge";
  createdAt: string;
  title: string;
  detail: string;
  href: string;
  deletePath: string;
}

const short = (label: string | undefined, fallback: string) =>
  label ? (label.split(",")[0] ?? label) : fallback;

async function Content() {
  const { supabase } = await getSession();
  const [trips, charges] = await Promise.all([
    listTripCalculations(supabase),
    listChargeCalculations(supabase),
  ]);

  const items: Item[] = [
    ...trips.map((trip) => ({
      id: trip.id,
      kind: "trip" as const,
      createdAt: trip.created_at,
      title: `${short(trip.origin.label, "A")} → ${short(trip.destination.label, "B")}`,
      detail: `${formatNumber(trip.route.distance_km, 0)} km · usa ${formatNumber(trip.consumed_pct, 0)} % · llegas con ${formatNumber(trip.arrival_soc, 0)} %`,
      href: tripRepeatHref(trip),
      deletePath: `/trip-calculations/${trip.id}`,
    })),
    ...charges.map((calc) => ({
      id: calc.id,
      kind: "charge" as const,
      createdAt: calc.created_at,
      title: `Carga ${formatNumber(calc.start_soc, 0)} → ${formatNumber(calc.target_soc, 0)} %`,
      detail: [
        durationLabel(calc.duration_min),
        `${formatNumber(calc.grid_kwh, 1)} kWh`,
        calc.cost === null ? null : cop(calc.cost, calc.currency),
      ]
        .filter(Boolean)
        .join(" · "),
      href: chargeRepeatHref(calc),
      deletePath: `/charge-calculations/${calc.id}`,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-card p-5 text-center text-[15px] text-muted-foreground">
        Aquí aparecen los trayectos y cargas que guardes. Empieza en{" "}
        <Link
          href="/trip"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          Trayecto
        </Link>{" "}
        o{" "}
        <Link
          href="/charge"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          Carga
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="mb-4 flex flex-col gap-2">
      {items.map((item) => {
        const Icon = item.kind === "trip" ? RouteIcon : Zap;
        return (
          <li
            key={`${item.kind}-${item.id}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3"
          >
            <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" strokeWidth={1.75} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold">{item.title}</span>
              <span className="text-[13px] text-muted-foreground">
                {sessionDay(item.createdAt)} · {item.detail}
              </span>
            </span>
            <Link
              href={item.href}
              className="flex min-h-11 shrink-0 items-center rounded-xl border border-input px-3 text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Repetir
              <span className="sr-only"> {item.title}</span>
            </Link>
            <DeleteButton path={item.deletePath} label={item.title} />
          </li>
        );
      })}
    </ul>
  );
}
