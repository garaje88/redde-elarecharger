import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/server/services/profile";
import { getSession } from "@/server/session";
import { signOut } from "../actions";
import { AccountActions } from "./account-actions";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6 pb-4">
      <h1 className="font-heading text-[22px] font-semibold">Ajustes</h1>
      <Content />

      <section aria-labelledby="account" className="flex flex-col gap-3 rounded-[20px] bg-card p-4">
        <h2 id="account" className="font-heading text-[17px] font-semibold">
          Tu cuenta y tus datos
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

async function Content() {
  const { userId, supabase } = await getSession();
  return <SettingsForm profile={await getProfile(supabase, userId)} />;
}
