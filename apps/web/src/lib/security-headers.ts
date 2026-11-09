// Security headers (docs/PLAN.md, Seguridad). Pure functions so proxy.ts, next.config.ts and the
// tests share one definition.

export interface CspOptions {
  nonce: string;
  isDev: boolean;
  supabaseUrl: string;
  /** Map style; its origin serves the style, sprites, glyphs and vector tiles. */
  mapStyleUrl: string;
  /** Sentry ingest origin, when browser error reporting is enabled. */
  sentryDsn?: string;
}

export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const origin = (url: string) => new URL(url).origin;

/**
 * Strict CSP: scripts only with the per-request nonce ('strict-dynamic' lets them load their own
 * chunks). Styles allow 'unsafe-inline' because React, Recharts and MapLibre set style
 * attributes; style injection cannot run code.
 */
export function buildCsp({ nonce, isDev, supabaseUrl, mapStyleUrl, sentryDsn }: CspOptions) {
  const supabase = origin(supabaseUrl);
  const map = origin(mapStyleUrl);
  const connect = ["'self'", supabase, supabase.replace(/^http/, "ws"), map];
  if (sentryDsn) connect.push(origin(sentryDsn));

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", map],
    "font-src": ["'self'", "data:", map],
    "connect-src": connect,
    // MapLibre's worker is served from /vendor; blob: covers its fallback.
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // Chrome applies form-action to the redirects that follow a form post.
    "form-action": ["'self'", supabase, "https://accounts.google.com"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  // Not against a local http Supabase (E2E), which the upgrade would break.
  if (!isDev && supabase.startsWith("https:")) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Headers for every response, including the API and static files. */
export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** The service worker must revalidate on every load and only runs its own code. */
export const SERVICE_WORKER_HEADERS: { key: string; value: string }[] = [
  { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
  { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
];

/** A fresh, unguessable nonce per request. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
