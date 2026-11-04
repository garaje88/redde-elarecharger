import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Db } from "./db";

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
/** The signed-in user's id and an RLS-bound client, for pages that call services. */
export async function getSession(): Promise<{ userId: string; supabase: Db }> {
  // Supabase reads the clock while validating the session: never during a prerender.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect("/login");
  return { userId: data.claims.sub, supabase };
}

export async function getCurrentUser(): Promise<SessionUser> {
  await connection();
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
