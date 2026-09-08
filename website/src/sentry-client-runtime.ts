import * as Sentry from "@sentry/nextjs";
import { monitoringEnvironment, monitoringRelease, sanitizeSentryEvent } from "@/lib/monitoring/sentry-options";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production" && Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: monitoringEnvironment(),
  release: monitoringRelease(),
  sendDefaultPii: false,
  sampleRate: 1,
  tracesSampleRate: 0.05,
  beforeSend: sanitizeSentryEvent
});

export const captureException = Sentry.captureException;
export const captureRouterTransitionStart = Sentry.captureRouterTransitionStart;
