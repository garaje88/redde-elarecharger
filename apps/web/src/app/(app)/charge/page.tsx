import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { parseChargeParams } from "@/features/history/repeat-links";
import { listChargers } from "@/server/services/chargers";
import { getProfile } from "@/server/services/profile";
import { listVehicles } from "@/server/services/vehicles";
import { getSession } from "@/server/session";
import { ChargeCalculator } from "./charge-calculator";

export const metadata: Metadata = { title: "Tiempo de carga" };

export default function ChargePage({ searchParams }: PageProps<"/charge">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6 md:max-w-xl">
      <Suspense
        fallback={
          <div aria-hidden="true" className="h-[600px] animate-pulse rounded-[20px] bg-muted" />
        }
      >
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/charge">, "searchParams">) {
  const initial = parseChargeParams(await searchParams);
  const { userId, supabase } = await getSession();
  const [vehicles, chargers, profile] = await Promise.all([
    listVehicles(supabase, userId),
    listChargers(supabase),
    getProfile(supabase, userId),
  ]);

  if (vehicles.length === 0 || chargers.length === 0) {
    return (
      <>
        <h1 className="font-heading text-[26px] font-semibold">Tiempo de carga</h1>
        <p className="rounded-2xl bg-card p-5 text-[15px] text-muted-foreground">
          {vehicles.length === 0
            ? "Primero agrega tu carro: la batería y el cargador a bordo definen el tiempo de carga."
            : "Agrega el cargador que usas en casa: el voltaje y el amperaje definen la potencia."}
        </p>
        <Link
          href={vehicles.length === 0 ? "/garage/vehicles/new" : "/garage/chargers/new"}
          className="flex min-h-13 items-center justify-center rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {vehicles.length === 0 ? "Agregar vehículo" : "Agregar cargador"}
        </Link>
      </>
    );
  }

  return (
    <ChargeCalculator vehicles={vehicles} chargers={chargers} profile={profile} initial={initial} />
  );
}
