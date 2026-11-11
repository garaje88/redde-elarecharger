import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemePicker } from "@/features/settings/theme-picker";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { getProfile } from "@/server/services/profile";
import { getCurrentUser, getSession } from "@/server/session";
import { signOut } from "../actions";
import { AccountActions } from "./account-actions";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Tu cuenta" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6 pb-4">
      <h1 className="font-heading text-[22px] font-semibold">Tu cuenta</h1>
      <AccountCard />
      <Appearance />
      <Content />

      <section aria-labelledby="account" className="flex flex-col gap-3 rounded-[20px] bg-card p-4">
        <h2 id="account" className="font-heading text-[17px] font-semibold">
          Descargar, borrar y cerrar sesión
        </h2>
        <AccountActions />
        <form action={signOut}>
          <Button type="submit" variant="outline" size="lg" className="min-h-11 w-full">
            Cerrar sesión
          </Button>
        </form>
      </section>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/privacidad" className="underline-offset-2 hover:underline">
          Aviso de privacidad
        </Link>
        {" · "}
        <Link href="/terminos" className="underline-offset-2 hover:underline">
          Términos
        </Link>
        {" · "}
        <Link href="/acerca" className="underline-offset-2 hover:underline">
          Acerca de
        </Link>
      </p>
    </main>
  );
}

/** Who is signed in. Initials instead of the Google photo: the CSP only allows our own images. */
async function AccountCard() {
  const user = await getCurrentUser();
  const initials =
    (user.name ?? user.email ?? "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";
  return (
    <section aria-label="Tus datos" className="flex items-center gap-4 rounded-[20px] bg-card p-4">
      <span
        aria-hidden="true"
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-lg font-semibold text-primary"
      >
        {initials}
      </span>
      <dl className="flex min-w-0 flex-col">
        <dt className="sr-only">Nombre</dt>
        <dd className="truncate text-[17px] font-semibold">{user.name ?? "Sin nombre"}</dd>
        <dt className="sr-only">Correo</dt>
        <dd className="truncate text-sm text-muted-foreground">{user.email ?? "Sin correo"}</dd>
        <dd className="text-xs text-muted-foreground">Cuenta de Google</dd>
      </dl>
    </section>
  );
}

async function Content() {
  const { userId, supabase } = await getSession();
  return <SettingsForm profile={await getProfile(supabase, userId)} />;
}

async function Appearance() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <section
      aria-labelledby="appearance"
      className="flex flex-col gap-3 rounded-[20px] bg-card p-4"
    >
      <h2 id="appearance" className="font-heading text-[17px] font-semibold">
        Apariencia
      </h2>
      <ThemePicker initial={theme} />
    </section>
  );
}
