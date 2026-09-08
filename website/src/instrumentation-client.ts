type RouterTransitionArgs = Parameters<typeof import("@sentry/nextjs").captureRouterTransitionStart>;

const sentryEnabled = process.env.NODE_ENV === "production" && Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export function onRouterTransitionStart(...args: RouterTransitionArgs) {
  if (!sentryEnabled) return;
  void import("./sentry-client-runtime").then(({ captureRouterTransitionStart }) => captureRouterTransitionStart(...args));
}
