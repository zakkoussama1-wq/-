import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  devIndicators: false,
  experimental: { proxyClientMaxBodySize: "24mb" },
  distDir: process.env.DZ_NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: ["127.0.0.1"],
  // Mutable runtime data is mounted separately, never bundled into the application.
  outputFileTracingExcludes: {
    "*": [
      "./data/local-demo/**/*",
      "./data/shopify-test/**/*",
      "./data/media/**/*",
      "./data/auth.sqlite*",
      "./data/checkout.sqlite*",
      "./data/orders.sqlite*",
      "./data/shipping.sqlite*",
      "./data/*.env",
      "./.env*",
      "./backups/**/*",
      "./test-results*/**/*",
      "./.next-local*/**/*",
      "./biome.json",
      "./.shopify/**/*",
    ],
  },
  outputFileTracingIncludes: {
    "/api/health": ["./scripts/postgres-schema.sql"],
    "/api/geography/*": ["./data/geography.sqlite"],
    "/api/storefront/*": ["./data/geography.sqlite"],
  },
};
export default config;
