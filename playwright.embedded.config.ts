import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/embedded-admin",
  outputDir: "test-results-embedded",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/shopify",
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      DATABASE_URL: "",
      SHOPIFY_CLIENT_ID: "fixture-client",
      SHOPIFY_CLIENT_SECRET: "",
      SHOPIFY_REDIRECT_URI: "",
      DZ_SHOPIFY_EMBEDDED: "1",
      DZ_SHOPIFY_ORDER_SYNC: "0",
      DZ_DISABLE_EXTERNAL_INTEGRATIONS: "1",
      DZ_LOCAL_DEMO: "0",
      DZ_NEXT_DIST_DIR: ".next-local-tests",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
  ],
  reporter: "list",
});
