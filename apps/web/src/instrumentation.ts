import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getServerEnv } = await import("./env");
    const env = getServerEnv();
    if (env.SENTRY_DSN) {
      const Sentry = await import("@sentry/nextjs");
      const { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } =
        await import("./lib/sentry-scrub");
      Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
        dataCollection: { ...SENTRY_DATA_COLLECTION, httpBodies: [] },
        tracesSampleRate: 0,
        beforeSend: (event) => scrubEvent(event),
        beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
      });
    }
  }
}

/** Reports server render and Route Handler errors; a no-op until Sentry is initialised. */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
