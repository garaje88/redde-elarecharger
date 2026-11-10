import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { GoogleSignInButton, GoogleSignInButtonFallback } from "./google-sign-in-button";

export const metadata: Metadata = { title: "Iniciar sesión" };

const FEATURES = [
  "Consumo de A a B con desnivel real",
  "Tiempo de carga en casa a 110 V o 220 V",
  "Tus recargas y estadísticas reales",
];

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-inverse text-inverse-foreground">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-7 pt-24 pb-12">
        <div className="flex flex-col gap-8">
          <BrandLogo className="h-12 w-auto self-start text-paper" />
          <h1 className="font-heading text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-[40px]">
            Sabe cuánta batería usas y cuánto tardas en cargar.
          </h1>
          <ul className="flex flex-col gap-3.5 text-[15px] text-inverse-subtle">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <span aria-hidden="true" className="size-2 rounded-full bg-brand-bright" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 flex flex-col gap-4">
          <Suspense fallback={<GoogleSignInButtonFallback />}>
            <GoogleSignInButton />
          </Suspense>
          <p className="text-center text-xs leading-normal text-inverse-muted">
            Solo cuentas Gmail o Google.
          </p>
        </div>
      </div>
    </main>
  );
}
