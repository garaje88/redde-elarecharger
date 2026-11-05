import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicEnv } from "@/env.public";
import { buildCsp, createNonce, DEFAULT_MAP_STYLE_URL } from "@/lib/security-headers";

// Paths reachable without a session. /api answers 401 itself and never redirects.
const PUBLIC_PATHS = ["/login", "/auth/", "/privacidad", "/terminos", "/acerca", "/offline"];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path.endsWith("/") ? path : `${path}/`),
  );

/**
 * Sets a per-request nonce CSP (Next.js reads it from the request header and stamps its scripts),
 * refreshes the Supabase session cookie and sends signed-out visitors to /login.
 */
export async function proxy(request: NextRequest) {
  const env = getPublicEnv();
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    mapStyleUrl: env.NEXT_PUBLIC_MAP_STYLE_URL ?? DEFAULT_MAP_STYLE_URL,
    sentryDsn: env.NEXT_PUBLIC_SENTRY_DSN,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const next = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  let response = next();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          requestHeaders.set("cookie", request.cookies.toString());
          response = next();
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getClaims validates the JWT and refreshes an expiring session; never trust getSession here.
  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;

  if (!data && !isPublic(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|vendor/|favicon.ico|manifest.webmanifest|robots.txt|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
