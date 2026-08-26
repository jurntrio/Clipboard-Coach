import * as Sentry from "@sentry/nextjs";
import { sendMonitoringAlert } from "@/lib/monitoring/email-alert";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("../sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("../sentry.edge.config");
}

export const onRequestError: typeof Sentry.captureRequestError = (error, request, context) => {
  Sentry.captureRequestError(error, request, context);
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const reason = error instanceof Error ? error : new Error(String(error));
    void sendMonitoringAlert({ source: "server", message: reason.message, stack: reason.stack, route: request.path }).catch(() => undefined);
  }
};
