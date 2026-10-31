import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
export default defineConfig({
  outputDir: "test-results-local",
  testDir: "./tests/local-demo",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:3003",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev:local -- --port 3003",
    env: {
      DZ_NEXT_DIST_DIR: ".next-local-tests",
      DZ_DEMO_DATA_DIR: join(tmpdir(), "dz-local-demo-" + randomUUID()),
    },
    url: "http://127.0.0.1:3003/api/health",
    reuseExistingServer: false,
  },
  reporter: "list",
});
