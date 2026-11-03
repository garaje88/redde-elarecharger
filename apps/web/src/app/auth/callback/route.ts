import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { recordAuditEvent } from "@/server/services/audit";

/** OAuth (PKCE) return point: trades the code for a session cookie, then goes back where the user was. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await recordAuditEvent(supabase, "sign_in", { provider: "google" });
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error("OAuth code exchange failed", { code: error.code });
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", "auth");
  return NextResponse.redirect(login);
}
