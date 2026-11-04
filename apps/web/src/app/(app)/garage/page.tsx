import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChargerRow } from "@/features/garage/charger-row";
import { DeleteButton } from "@/features/garage/delete-button";
import { VehicleCard } from "@/features/garage/vehicle-card";
import { listChargers } from "@/server/services/chargers";
import { listVehicles } from "@/server/services/vehicles";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Garaje" };

export default function GaragePage({ searchParams }: PageProps<"/garage">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6 md:max-w-2xl">
      <h1 className="font-heading text-[26px] font-semibold">Garaje</h1>
      <Suspense fallback={<GarageSkeleton />}>
        <GarageContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const tabClass = (active: boolean) =>
  `flex min-h-10 items-center justify-center rounded-[10px] text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
    active
      ? "bg-card font-semibold text-foreground shadow-xs"
      : "text-muted-foreground hover:text-foreground"
  }`;

const dashedLink =
  "flex min-h-13 items-center justify-center rounded-2xl border border-dashed border-muted-foreground/60 text-[15px] font-semibold hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

async function GarageContent({ searchParams }: Pick<PageProps<"/garage">, "searchParams">) {
  const { tab } = await searchParams;
  const showChargers = tab === "chargers";
  const { userId, supabase } = await getSession();
  const [vehicles, chargers] = await Promise.all([
    listVehicles(supabase, userId),
    listChargers(supabase),
  ]);

  return (
    <>
      <nav
        aria-label="Secciones del garaje"
        className="grid grid-cols-2 gap-1 rounded-[14px] bg-secondary p-1"
      >
        <Link
          href="/garage"
          aria-current={showChargers ? undefined : "page"}
          className={tabClass(!showChargers)}
        >
          Vehículos
        </Link>
        <Link
          href="/garage?tab=chargers"
          aria-current={showChargers ? "page" : undefined}
          className={tabClass(showChargers)}
        >
          Cargadores
        </Link>
      </nav>

      {showChargers ? (
        <section aria-label="Cargadores" className="flex flex-col gap-2">
          {chargers.length === 0 ? (
            <EmptyState text="Agrega el cargador que usas en casa para calcular el tiempo de carga." />
          ) : (
            chargers.map((charger) => (
              <ChargerRow
                key={charger.id}
                charger={charger}
                action={<DeleteButton path={`/chargers/${charger.id}`} label={charger.name} />}
              />
            ))
          )}
          <Link href="/garage/chargers/new" className={dashedLink}>
            + Cargador
          </Link>
        </section>
      ) : (
        <>
          {vehicles.length === 0 ? (
            <EmptyState text="Elige tu carro del catálogo y la app trae su ficha técnica." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <Link
              href="/garage/lookup?kind=vehicle"
              className="flex min-h-13 items-center justify-center gap-2.5 rounded-2xl bg-inverse text-[15px] font-semibold text-inverse-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Sparkles
                aria-hidden="true"
                className="size-5 text-brand-bright"
                strokeWidth={1.75}
              />
              No encuentro mi carro: buscar con IA
            </Link>
            <div className="grid grid-cols-2 gap-2.5">
              <Link href="/garage/vehicles/new" className={dashedLink}>
                + Vehículo
              </Link>
              <Link href="/garage/chargers/new" className={dashedLink}>
                + Cargador
              </Link>
            </div>
          </div>

          {chargers.length > 0 && (
            <section aria-labelledby="your-chargers" className="flex flex-col gap-2">
              <h2 id="your-chargers" className="text-sm font-semibold text-muted-foreground">
                Tus cargadores
              </h2>
              {chargers.map((charger) => (
                <ChargerRow key={charger.id} charger={charger} />
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl bg-card p-5 text-center text-[15px] text-muted-foreground">{text}</p>
  );
}

function GarageSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="h-12 animate-pulse rounded-[14px] bg-muted" />
      <div className="h-72 animate-pulse rounded-[20px] bg-muted" />
      <div className="h-13 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
