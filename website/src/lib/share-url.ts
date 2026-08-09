const PRODUCTION_ORIGIN = "https://app.sportvisualsystems.com";

export function buildPublicShareUrl(token: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const browserOrigin = typeof window === "undefined" ? "" : window.location.origin;
  const localBrowser = browserOrigin.includes("localhost") || browserOrigin.includes("127.0.0.1");
  const localConfiguration = configuredOrigin?.includes("localhost") || configuredOrigin?.includes("127.0.0.1");
  const origin = localBrowser
    ? (configuredOrigin && !localConfiguration ? configuredOrigin : PRODUCTION_ORIGIN)
    : (configuredOrigin && !localConfiguration ? configuredOrigin : browserOrigin || PRODUCTION_ORIGIN);

  return `${origin}/share/${token}`;
}
