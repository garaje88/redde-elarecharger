"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { PRIVACY_VERSION } from "@/lib/legal";
import { safeRedirectPath } from "@/lib/safe-redirect";

export function GoogleSignInButton() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(searchParams.get("error") === "auth");
  const [accepted, setAccepted] = useState(false);
  const deleted = searchParams.get("deleted") === "1";

  async function signIn() {
    setPending(true);
    setFailed(false);
    const next = safeRedirectPath(searchParams.get("next"));
    // The callback records the consent for this version of the notice (Ley 1581 de 2012).
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&consent=${PRIVACY_VERSION}`;
    // Loaded on demand: supabase-js is the bulk of this page's JavaScript.
    const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
    const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, scopes: "openid email profile" },
    });
    // On success the browser is already navigating to Google.
    if (error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-h-11 items-start gap-3 text-sm leading-normal text-inverse-muted">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-brand-bright"
        />
        <span>
          Acepto los{" "}
          <Link href="/terminos" className="text-brand-bright underline underline-offset-2">
            términos
          </Link>{" "}
          y autorizo el tratamiento de mis datos según el{" "}
          <Link href="/privacidad" className="text-brand-bright underline underline-offset-2">
            aviso de privacidad
          </Link>{" "}
          (Ley 1581 de 2012).
        </span>
      </label>
      <button
        type="button"
        onClick={signIn}
        disabled={pending || !accepted}
        className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-white text-base font-semibold text-inverse transition-opacity outline-none focus-visible:ring-4 focus-visible:ring-brand-bright/60 disabled:opacity-70"
      >
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-full border-[1.5px] border-inverse font-heading text-[15px] font-bold"
        >
          G
        </span>
        {pending ? "Conectando con Google…" : "Continuar con Google"}
      </button>
      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-center text-sm text-inverse-danger"
      >
        {failed
          ? "No pudimos iniciar sesión con Google. Inténtalo de nuevo."
          : deleted
            ? "Tu cuenta y tus datos fueron borrados."
            : ""}
      </p>
    </div>
  );
}

export function GoogleSignInButtonFallback() {
  return <div aria-hidden="true" className="h-[134px] rounded-2xl bg-white/10" />;
}
