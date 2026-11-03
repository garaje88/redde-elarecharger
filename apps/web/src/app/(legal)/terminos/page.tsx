import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Términos y condiciones" };

// Placeholder: the legal text must be written and reviewed before production (phase 7).
export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-12">
      <h1 className="font-heading text-3xl font-semibold">Términos y condiciones</h1>
      <p className="text-muted-foreground">
        Este documento está en preparación y estará disponible antes del lanzamiento público.
      </p>
      <Link href="/login" className="text-primary underline-offset-2 hover:underline">
        Volver
      </Link>
    </main>
  );
}
