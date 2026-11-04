import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Acerca de" };

const SOURCES = [
  {
    name: "Open EV Data",
    href: "https://github.com/KilowattApp/open-ev-data",
    detail:
      "Fichas de vehículos eléctricos: batería, carga AC y DC, consumo y curvas de carga. Licencia MIT.",
  },
  {
    name: "EPA fueleconomy.gov",
    href: "https://www.fueleconomy.gov/feg/ws/",
    detail: "Autonomía y consumo homologados en Estados Unidos, para validar y completar datos.",
  },
  {
    name: "Open Charge Map",
    href: "https://openchargemap.org",
    detail: "Tipos de conector y niveles de carga de referencia.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="font-heading text-3xl font-semibold">Acerca de Elacharger</h1>
      <p className="text-[15px] leading-relaxed">
        Elacharger calcula cuánta batería usa tu carro eléctrico en un trayecto y cuánto tarda en
        cargar en casa. Los resultados son estimaciones: dependen de tu forma de manejar, el clima y
        el estado de la batería.
      </p>
      <section aria-labelledby="data-sources" className="flex flex-col gap-3">
        <h2 id="data-sources" className="font-heading text-xl font-semibold">
          Fuentes de datos
        </h2>
        <p className="text-[15px] text-muted-foreground">
          El catálogo de vehículos y cargadores se construye con estas fuentes abiertas, más los
          aportes de los usuarios revisados por un administrador. Cada dato muestra su fuente y
          fecha.
        </p>
        <ul className="flex flex-col gap-3">
          {SOURCES.map((source) => (
            <li key={source.name} className="rounded-2xl bg-card p-4">
              <a
                href={source.href}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                {source.name}
              </a>
              <p className="text-sm text-muted-foreground">{source.detail}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Datos de vehículos: Open EV Data (https://github.com/KilowattApp/open-ev-data), © 2024
          Tijs Teulings, licencia MIT con atribución.
        </p>
      </section>
      <Link
        href="/"
        className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
