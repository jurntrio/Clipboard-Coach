const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
  },
  webpack(config) {
    // DrawingCanvas is shared with the desktop app and lives one directory
    // above this package. Netlify installs only website/node_modules, so make
    // sure imports from that shared file resolve to this app's React runtime.
    config.resolve.modules = [
      path.resolve(__dirname, "node_modules"),
      ...(config.resolve.modules || ["node_modules"])
    ];
    return config;
  }
};

module.exports = nextConfig;
