import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiError } from "@/server/http";
import { getVehicle } from "@/server/services/vehicles";
import { getSession } from "@/server/session";
import { VehicleEditor } from "./vehicle-editor";

export const metadata: Metadata = { title: "Editar vehículo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function VehiclePage({ params }: PageProps<"/garage/vehicles/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6">
      <Suspense
        fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-[20px] bg-muted" />}
      >
        <Editor params={params} />
      </Suspense>
    </main>
  );
}

async function Editor({ params }: Pick<PageProps<"/garage/vehicles/[id]">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { userId, supabase } = await getSession();
  const vehicle = await getVehicle(supabase, userId, id).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  return <VehicleEditor vehicle={vehicle} />;
}
