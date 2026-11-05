import type { Metadata } from "next";
import Link from "next/link";
import { parseTripParams } from "@/features/history/repeat-links";
import { getProfile } from "@/server/services/profile";
import { listVehicles } from "@/server/services/vehicles";
import { getSession } from "@/server/session";
import { TripPlanner } from "./trip-planner";

export const metadata: Metadata = { title: "Trayecto" };

export default function TripPage({ searchParams }: PageProps<"/trip">) {
  return <Content searchParams={searchParams} />;
}

async function Content({ searchParams }: Pick<PageProps<"/trip">, "searchParams">) {
  const initial = parseTripParams(await searchParams);
  const { userId, supabase } = await getSession();
  const [vehicles, profile] = await Promise.all([
    listVehicles(supabase, userId),
    getProfile(supabase, userId),
  ]);

  if (vehicles.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6">
        <h1 className="font-heading text-[26px] font-semibold">Trayecto</h1>
        <p className="rounded-2xl bg-card p-5 text-[15px] text-muted-foreground">
          Agrega tu carro para calcular cuánta batería usa un trayecto.
        </p>
        <Link
          href="/garage/vehicles/new"
          className="flex min-h-13 items-center justify-center rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Agregar vehículo
        </Link>
      </main>
    );
  }
  return <TripPlanner vehicles={vehicles} profile={profile} initial={initial} />;
}
