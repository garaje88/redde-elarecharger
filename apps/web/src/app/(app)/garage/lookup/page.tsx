import type { Metadata } from "next";
import { Suspense } from "react";
import { LookupFlow } from "./lookup-flow";

export const metadata: Metadata = { title: "Buscar con IA" };

export default function LookupPage({ searchParams }: PageProps<"/garage/lookup">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6">
      <Suspense>
        <LookupContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LookupContent({ searchParams }: Pick<PageProps<"/garage/lookup">, "searchParams">) {
  const { kind, q } = await searchParams;
  return (
    <LookupFlow
      kind={kind === "charger" ? "charger" : "vehicle"}
      initialQuery={typeof q === "string" ? q.slice(0, 200) : ""}
    />
  );
}
