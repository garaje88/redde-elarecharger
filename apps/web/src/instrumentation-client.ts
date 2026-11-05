import { config } from "zod";

// Zod probes `Function("")` to decide whether to compile parsers; the CSP forbids eval, so
// tell it up front instead of logging a violation on every page.
config({ jitless: true });

// Browser error reporting, only when NEXT_PUBLIC_SENTRY_DSN is set. Loaded lazily so the SDK stays
// out of the first-load bundle.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void Promise.all([import("@sentry/nextjs"), import("./lib/sentry-scrub")]).then(
    ([Sentry, { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent }]) => {
      Sentry.init({
        dsn,
        dataCollection: { ...SENTRY_DATA_COLLECTION, httpBodies: [] },
        tracesSampleRate: 0,
        beforeSend: (event) => scrubEvent(event),
        beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
      });
    },
  );
}
