// Error reports never carry personal data (docs/PLAN.md, Observabilidad): emails, coordinates,
// cookies, tokens and request bodies are removed before an event leaves the process.

/** Sentry `dataCollection`: nothing about the user or the request is collected at the source. */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
} as const;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Four or more decimals is street-level precision; plain numbers (ids, kWh, %) keep fewer.
const COORDINATE = /-?\d{1,3}\.\d{4,}/g;
const BEARER = /Bearer\s+[\w.~+/-]+=*/gi;
const SENSITIVE_KEY =
  /^(email|e-mail|lat|lng|lon|latitude|longitude|origin|destination|coordinates|geometry|route_polyline|polyline|token|access_token|refresh_token|authorization|cookie|password|location_label|origin_label|dest_label|display_name|name|notes)$/i;

export function scrubString(value: string): string {
  return value
    .replace(EMAIL, "[email]")
    .replace(BEARER, "Bearer [token]")
    .replace(COORDINATE, "[coord]");
}

/** Deep copy of `value` with sensitive keys replaced and strings scrubbed. */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return scrubString(value);
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[filtered]" : scrubValue(item, depth + 1),
    ]),
  );
}

interface ScrubbableEvent {
  user?: { id?: string | number };
  request?: { url?: string; method?: string };
}

/** `beforeSend` for Sentry: keeps the pseudonymous user id, drops everything identifying. */
export function scrubEvent<E extends object>(event: E): E {
  const { user, request, ...rest } = event as E & ScrubbableEvent;
  const scrubbed = scrubValue(rest) as E & ScrubbableEvent;
  if (user?.id !== undefined) scrubbed.user = { id: user.id };
  if (request) {
    // Query strings carry coordinates and search text; headers carry cookies and tokens.
    scrubbed.request = {
      ...(request.url ? { url: scrubString(request.url.split("?")[0] ?? "") } : {}),
      ...(typeof request.method === "string" ? { method: request.method } : {}),
    };
  }
  return scrubbed;
}

/** `beforeBreadcrumb`: keeps navigation and fetch breadcrumbs without URLs' query strings. */
export function scrubBreadcrumb<B extends { data?: Record<string, unknown>; message?: string }>(
  breadcrumb: B,
): B {
  const data = breadcrumb.data
    ? Object.fromEntries(
        Object.entries(breadcrumb.data).map(([key, value]) => [
          key,
          typeof value === "string" && /url|from|to/i.test(key)
            ? scrubString(value.split("?")[0] ?? "")
            : scrubValue(value),
        ]),
      )
    : undefined;
  return {
    ...breadcrumb,
    ...(breadcrumb.message ? { message: scrubString(breadcrumb.message) } : {}),
    ...(data ? { data } : {}),
  };
}
