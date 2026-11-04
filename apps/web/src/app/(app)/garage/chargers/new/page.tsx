import type { Metadata } from "next";
import { Suspense } from "react";
import { ChargerForm } from "./charger-form";

export const metadata: Metadata = { title: "Agregar cargador" };

export default function NewChargerPage({ searchParams }: PageProps<"/garage/chargers/new">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6">
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/garage/chargers/new">, "searchParams">) {
  const { q } = await searchParams;
  return <ChargerForm initialQuery={typeof q === "string" ? q.slice(0, 80) : ""} />;
}
