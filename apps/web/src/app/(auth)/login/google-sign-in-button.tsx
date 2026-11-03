"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/safe-redirect";

export function GoogleSignInButton() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(searchParams.get("error") === "auth");

  async function signIn() {
    setPending(true);
    setFailed(false);
    const next = safeRedirectPath(searchParams.get("next"));
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
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
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
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
        {failed ? "No pudimos iniciar sesión con Google. Inténtalo de nuevo." : ""}
      </p>
    </div>
  );
}

export function GoogleSignInButtonFallback() {
  return <div aria-hidden="true" className="h-14 rounded-2xl bg-white/80" />;
}
