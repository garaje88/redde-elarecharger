import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión" };

/** Served by the service worker when a page cannot load. Works without JavaScript. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-heading text-2xl font-semibold">Sin conexión</h1>
      <p className="text-[15px] text-muted-foreground">
        Elacharger necesita internet para calcular rutas y guardar tus datos. Revisa tu conexión e
        inténtalo de nuevo.
      </p>
      {/* A plain link: a full reload retries the page once the connection is back. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="flex min-h-11 items-center rounded-2xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground"
      >
        Reintentar
      </a>
    </main>
  );
}
