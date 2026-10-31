import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev",
    env: {
      DZ_AUTH_TEST_BYPASS: "1",
      AUTH_DATABASE_PATH: join(tmpdir(), "dz-auth-playwright.sqlite"),
      ORDERS_DATABASE_PATH: join(tmpdir(), "dz-orders-playwright.sqlite"),
      CHECKOUT_DATABASE_PATH:
        process.env.PLAYWRIGHT_CHECKOUT_DATABASE_PATH ??
        join(tmpdir(), "dz-checkout-playwright.sqlite"),
      SHIPPING_DATABASE_PATH:
        process.env.PLAYWRIGHT_SHIPPING_DATABASE_PATH ??
        join(tmpdir(), "dz-shipping-playwright.sqlite"),
    },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
  },
  reporter: "list",
});
