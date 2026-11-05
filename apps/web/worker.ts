// Cloudflare Worker entry: the OpenNext handler wrapped by Sentry, which needs the Worker's env
// to start (docs.sentry.io, "Next.js on Cloudflare"). Without SENTRY_DSN it stays off.
// Type-checked by Wrangler's build, not tsc: .open-next only exists after `opennextjs-cloudflare build`.
import * as Sentry from "@sentry/nextjs/cloudflare";
import handler from "./.open-next/worker.js";
import { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from "./src/lib/sentry-scrub";

interface SentryEnv {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
}

export default Sentry.withSentry(
  (env: SentryEnv) =>
    env.SENTRY_DSN
      ? {
          dsn: env.SENTRY_DSN,
          environment: env.SENTRY_ENVIRONMENT ?? "production",
          dataCollection: { ...SENTRY_DATA_COLLECTION, httpBodies: [] },
          tracesSampleRate: 0,
          beforeSend: (event) => scrubEvent(event),
          beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
        }
      : undefined,
  handler,
);
