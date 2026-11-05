import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Signs in a fresh test user without Google: the admin API creates the user and a magic link,
// and verifying its hash yields a real session. Needs a local (or test) Supabase with its
// secret key.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const secretKey = process.env.E2E_SUPABASE_SECRET_KEY;

export interface TestSession {
  userId: string;
  accessToken: string;
  /** Playwright storage state carrying the @supabase/ssr session cookies. */
  storageState: {
    cookies: {
      name: string;
      value: string;
      domain: string;
      path: string;
      expires: number;
      httpOnly: boolean;
      secure: boolean;
      sameSite: "Lax";
    }[];
    origins: never[];
  };
}

export async function createTestSession(baseURL: string | undefined): Promise<TestSession> {
  if (!secretKey) throw new Error("E2E_SUPABASE_SECRET_KEY is not set.");
  const admin = createClient(url, secretKey, { auth: { persistSession: false } });
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@elacharger.test`;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: "Prueba E2E" },
  });
  if (created.error) throw created.error;
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;

  const anon = createClient(url, publishableKey, { auth: { persistSession: false } });
  const verified = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.data.properties.hashed_token,
  });
  if (verified.error || !verified.data.session) throw verified.error ?? new Error("No session");
  const { session } = verified.data;

  // Let @supabase/ssr encode the session cookies exactly as the app expects them.
  const jar: { name: string; value: string }[] = [];
  const ssr = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => jar,
      setAll: (cookies) => {
        jar.splice(0, jar.length, ...cookies.map(({ name, value }) => ({ name, value })));
      },
    },
  });
  await ssr.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  const { hostname } = new URL(baseURL ?? "http://localhost");
  return {
    userId: session.user.id,
    accessToken: session.access_token,
    storageState: {
      cookies: jar.map(({ name, value }) => ({
        name,
        value,
        domain: hostname,
        path: "/",
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      })),
      origins: [],
    },
  };
}
