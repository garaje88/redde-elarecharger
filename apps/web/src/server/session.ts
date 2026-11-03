import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Data access layer entry point for pages: verifies the session cookie on the server
 * (getClaims, never getSession) and returns a narrow user, or redirects to /login.
 * Reads cookies, so callers must render it behind a <Suspense> boundary.
 */
export async function getCurrentUser(): Promise<SessionUser> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", data.claims.sub)
    .maybeSingle();

  return {
    id: data.claims.sub,
    name: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
  };
}
