import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PRIVACY_VERSION } from "@/lib/legal";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { recordAuditEvent } from "@/server/services/audit";
import { recordPrivacyConsent } from "@/server/services/profile";

/** OAuth (PKCE) return point: trades the code for a session cookie, then goes back where the user was. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await recordAuditEvent(supabase, "sign_in", { provider: "google" });
      // The login page only starts the flow once the user ticks the consent box.
      if (searchParams.get("consent") === PRIVACY_VERSION) {
        await recordPrivacyConsent(supabase, data.user.id, PRIVACY_VERSION).catch((failure) =>
          console.error("privacy consent not recorded", failure),
        );
      }
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error("OAuth code exchange failed", { code: error.code });
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", "auth");
  return NextResponse.redirect(login);
}
