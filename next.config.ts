import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  devIndicators: false,
  distDir: process.env.DZ_NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingIncludes: {
    "/api/geography/*": ["./data/geography.sqlite"],
  },
};
export default config;
