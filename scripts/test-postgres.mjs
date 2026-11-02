import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const env = { ...process.env };
if (!env.POSTGRES_TEST_URL) {
  const values = Object.fromEntries(
    readFileSync("data/postgres-dev.env", "utf8")
      .trim()
      .split("\n")
      .map((s) => {
        const i = s.indexOf("=");
        return [s.slice(0, i), s.slice(i + 1)];
      }),
  );
  const url = new URL("postgresql://127.0.0.1:55432/");
  url.username = values.POSTGRES_USER;
  url.password = values.POSTGRES_PASSWORD;
  url.pathname = "/" + values.POSTGRES_DB;
  env.POSTGRES_TEST_URL = url.toString();
}
const result = spawnSync(
  "npm",
  [
    "test",
    "--",
    "tests/postgres.integration.test.ts",
    "tests/multitenant-security.test.ts",
    "tests/shopify-catalog.test.ts",
  ],
  { env, stdio: "inherit" },
);
process.exit(result.status ?? 1);
