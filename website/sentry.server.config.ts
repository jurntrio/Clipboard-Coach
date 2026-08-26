import * as Sentry from "@sentry/nextjs";
import { monitoringEnvironment, monitoringRelease, sanitizeSentryEvent } from "./src/lib/monitoring/sentry-options";

Sentry.init({ dsn: process.env.SENTRY_DSN, enabled: process.env.NODE_ENV === "production" && Boolean(process.env.SENTRY_DSN), environment: monitoringEnvironment(), release: monitoringRelease(), sendDefaultPii: false, sampleRate: 1, tracesSampleRate: 0.05, beforeSend: sanitizeSentryEvent });
