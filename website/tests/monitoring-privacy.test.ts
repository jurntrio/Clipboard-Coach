import assert from "node:assert/strict";
import test from "node:test";
import type { ErrorEvent } from "@sentry/nextjs";
import { sanitizeSentryEvent } from "../src/lib/monitoring/sentry-options.ts";

test("removes sensitive request data and URL query strings from monitoring events", () => {
  const event = sanitizeSentryEvent({
    user: { id: "user-1", email: "player@example.com", ip_address: "127.0.0.1" },
    request: {
      url: "https://app.sportvisualsystems.com/dashboard?token=secret",
      query_string: "token=secret",
      cookies: { session: "secret" },
      data: { videoName: "private.mp4" },
      headers: { authorization: "Bearer secret", accept: "application/json" }
    },
    extra: { token: "secret", matchId: "match-1" },
    breadcrumbs: [{ message: "request", data: { password: "secret", status: 500 } }]
  } as ErrorEvent);

  assert.deepEqual(event.user, { id: "user-1" });
  assert.equal(event.request?.url, "https://app.sportvisualsystems.com/dashboard");
  assert.equal(event.request?.query_string, undefined);
  assert.equal(event.request?.cookies, undefined);
  assert.equal(event.request?.data, undefined);
  assert.equal(event.request?.headers?.authorization, "[Filtered]");
  assert.equal(event.request?.headers?.accept, "application/json");
  assert.equal(event.extra?.token, "[Filtered]");
  assert.equal(event.extra?.matchId, "match-1");
  assert.equal(event.breadcrumbs?.[0].data?.password, "[Filtered]");
});
