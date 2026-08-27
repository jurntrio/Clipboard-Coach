const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Netlify's image endpoint is not available for this deployment setup.
    // Serve the already optimized branding assets and uploaded images directly.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev"
      },
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com"
      }
    ]
  }
};

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  webpack: { treeshake: { removeDebugLogging: true } }
});
