import "server-only";
import type { Database } from "@elacharger/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseTokenClient } from "@/lib/supabase/server";
import { apiHandler, unauthorized } from "./http";

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AuthContext {
  user: AuthUser;
  method: "bearer" | "cookie";
  /** Supabase client acting as the user, so RLS applies to every query. */
  supabase: SupabaseClient<Database>;
}

const BEARER = /^Bearer\s+(\S+)$/i;

async function verify(
  supabase: SupabaseClient<Database>,
  token: string | undefined,
): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data) return null;
  const email = data.claims.email;
  return { id: data.claims.sub, email: typeof email === "string" ? email : null };
}

/**
 * Resolves the caller from `Authorization: Bearer <supabase access token>` (mobile, curl)
 * or, when the header is absent, from the Supabase session cookie (web).
 * Returns null for anonymous requests; throws 401 for a malformed or invalid bearer token.
 */
export async function authenticate(request: NextRequest): Promise<AuthContext | null> {
  const header = request.headers.get("authorization");

  if (header !== null) {
    const token = BEARER.exec(header.trim())?.[1];
    if (!token)
      throw unauthorized("The Authorization header must use the 'Bearer <token>' scheme.");
    const supabase = createSupabaseTokenClient(token);
    const user = await verify(supabase, token);
    if (!user) throw unauthorized("The access token is invalid or expired.");
    return { user, method: "bearer", supabase };
  }

  const supabase = await createSupabaseServerClient();
  const user = await verify(supabase, undefined);
  return user ? { user, method: "cookie", supabase } : null;
}

export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const auth = await authenticate(request);
  if (!auth) throw unauthorized("Authentication required.");
  return auth;
}

/** Like apiHandler, but answers 401 (never a redirect) unless the caller is authenticated. */
export function authedHandler<Ctx>(
  handler: (request: NextRequest, auth: AuthContext, context: Ctx) => Promise<Response>,
) {
  return apiHandler<Ctx>(async (request, context) =>
    handler(request, await requireAuth(request), context),
  );
}
