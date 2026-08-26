import type { ErrorEvent } from "@sentry/nextjs";

const SECRET_KEY = /authorization|cookie|token|secret|password|email|phone|name/i;

function cleanUrl(value: string | undefined) {
  if (!value) return value;
  try {
    const url = new URL(value, "https://monitoring.invalid");
    return `${url.origin === "https://monitoring.invalid" ? "" : url.origin}${url.pathname}`;
  } catch {
    return value.split("?")[0].split("#")[0];
  }
}

function scrubRecord(value: Record<string, unknown> | undefined) {
  if (!value) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? "[Filtered]" : item]));
}

export function sanitizeSentryEvent(event: ErrorEvent) {
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.request) {
    event.request.url = cleanUrl(event.request.url);
    event.request.query_string = undefined;
    event.request.cookies = undefined;
    event.request.data = undefined;
    event.request.headers = scrubRecord(event.request.headers as Record<string, unknown> | undefined) as Record<string, string> | undefined;
  }
  event.extra = scrubRecord(event.extra);
  event.contexts = scrubRecord(event.contexts) as ErrorEvent["contexts"];
  event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({ ...breadcrumb, data: scrubRecord(breadcrumb.data) }));
  return event;
}

export function monitoringRelease() {
  return process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.SENTRY_RELEASE || process.env.COMMIT_REF || process.env.NEXT_PUBLIC_COMMIT_SHA || "development";
}

export function monitoringEnvironment() {
  return process.env.CONTEXT || process.env.NODE_ENV || "development";
}
