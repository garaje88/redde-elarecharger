import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_UPDATED_ON, PRIVACY_VERSION } from "@/lib/legal";
import { LegalSection } from "../legal-section";

export const metadata: Metadata = { title: "Términos de uso" };

export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold">Términos de uso</h1>
        <p className="text-sm text-muted-foreground">
          Versión {PRIVACY_VERSION} · actualizado el {PRIVACY_UPDATED_ON}
        </p>
      </div>

      <LegalSection title="El servicio">
        <p>
          Elacharger es una herramienta gratuita que estima el consumo de batería de un trayecto y
          el tiempo y costo de cargar un carro eléctrico en casa.
        </p>
      </LegalSection>

      <LegalSection title="Los resultados son estimaciones">
        <p>
          Los cálculos usan fichas técnicas, rutas y modelos aproximados. El consumo real cambia con
          tu forma de manejar, el tráfico, el clima y el estado de la batería. Planea siempre con
          margen y no dependas solo de la app para decidir si llegas a tu destino.
        </p>
      </LegalSection>

      <LegalSection title="Instalaciones eléctricas">
        <p>
          La app no reemplaza a un electricista. Cualquier instalación o cambio en tu circuito de
          carga debe hacerlo una persona certificada, según el RETIE.
        </p>
      </LegalSection>

      <LegalSection title="Tu cuenta">
        <p>
          Entras con tu cuenta Google y eres responsable de lo que hagas con ella. Puedes dejar de
          usar el servicio y borrar tu cuenta cuando quieras desde Ajustes.
        </p>
      </LegalSection>

      <LegalSection title="Uso aceptable">
        <p>
          No uses la app para automatizar consultas masivas, intentar acceder a datos de otros
          usuarios ni afectar su funcionamiento. Podemos limitar o suspender cuentas que lo hagan.
        </p>
      </LegalSection>

      <LegalSection title="Tus datos">
        <p>
          Tratamos tus datos según el{" "}
          <Link href="/privacidad" className="text-primary underline underline-offset-2">
            aviso de privacidad
          </Link>
          .
        </p>
      </LegalSection>

      <Link href="/login" className="text-primary underline-offset-2 hover:underline">
        Volver
      </Link>
    </main>
  );
}
