import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listChargers } from "@/server/services/chargers";
import { getProfile } from "@/server/services/profile";
import { listVehicles } from "@/server/services/vehicles";
import { getSession } from "@/server/session";
import { SessionForm } from "./session-form";

export const metadata: Metadata = { title: "Registrar recarga" };

export default function NewSessionPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6">
      <Suspense
        fallback={
          <div aria-hidden="true" className="h-[600px] animate-pulse rounded-[20px] bg-muted" />
        }
      >
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const { userId, supabase } = await getSession();
  const [vehicles, chargers, profile] = await Promise.all([
    listVehicles(supabase, userId),
    listChargers(supabase),
    getProfile(supabase, userId),
  ]);
  if (vehicles.length === 0) {
    return (
      <>
        <h1 className="font-heading text-[22px] font-semibold">Registrar recarga</h1>
        <p className="rounded-2xl bg-card p-5 text-[15px] text-muted-foreground">
          Primero agrega tu carro en el{" "}
          <Link
            href="/garage/vehicles/new"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            garaje
          </Link>
          .
        </p>
      </>
    );
  }
  return <SessionForm vehicles={vehicles} chargers={chargers} profile={profile} />;
}
