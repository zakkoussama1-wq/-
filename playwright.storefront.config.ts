import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/storefront",
  outputDir: "test-results-storefront",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 12000 },
  use: {
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
  reporter: "list",
});
