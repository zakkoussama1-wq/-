import { mkdirSync, chmodSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
const directory = resolve(process.env.DZ_DEMO_DATA_DIR ?? "data/local-demo");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const paths = Object.fromEntries(
  ["auth", "shipping", "checkout", "orders"].map((name) => [
    name.toUpperCase() + "_DATABASE_PATH",
    join(directory, name + ".sqlite"),
  ]),
);
const db = new DatabaseSync(paths.SHIPPING_DATABASE_PATH);
try {
  db.exec(
    "PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS shipping_settings(merchant_id TEXT NOT NULL,mode TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,generic_office INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(merchant_id,mode)); CREATE TABLE IF NOT EXISTS shipping_rules(merchant_id TEXT NOT NULL,mode TEXT NOT NULL,scope TEXT NOT NULL,target TEXT NOT NULL,rule_json TEXT NOT NULL,PRIMARY KEY(merchant_id,mode,scope,target),FOREIGN KEY(merchant_id,mode) REFERENCES shipping_settings(merchant_id,mode))",
  );
  db.exec("BEGIN IMMEDIATE");
  for (const mode of ["legacy58", "updated69"]) {
    const result = db
      .prepare("INSERT OR IGNORE INTO shipping_settings VALUES(?,?,0,1)")
      .run("local-demo-merchant", mode);
    if (result.changes)
      db.prepare("INSERT INTO shipping_rules VALUES(?,?,?,?,?)").run(
        "local-demo-merchant",
        mode,
        "default",
        "*",
        JSON.stringify({
          available: true,
          home: { enabled: true, price: 500 },
          office: { enabled: true, price: 350 },
          eta: "",
        }),
      );
  }
  db.exec("COMMIT");
} finally {
  db.close();
  chmodSync(paths.SHIPPING_DATABASE_PATH, 0o600);
}
const env = {
  ...process.env,
  ...paths,
  NODE_ENV: "development",
  DZ_NEXT_DIST_DIR: process.env.DZ_NEXT_DIST_DIR ?? ".next-local",
  DZ_LOCAL_DEMO: "1",
  DZ_DISABLE_EXTERNAL_INTEGRATIONS: "1",
  LOCAL_MERCHANT_ID: "local-demo-merchant",
};
// This explicit demo command always uses local SQLite, independent of configured cloud services.
delete env.DATABASE_URL;
delete env.DZ_AUTH_TEST_BYPASS;
for (const name of Object.keys(env))
  if (name.startsWith("SHOPIFY_")) delete env[name];
console.log(
  "LOCAL DEMO: /form = order form; /dashboard = administration. No login needed in this development mode. Synthetic shipping: home500DZD, office350DZD; changes persist in data/local-demo. External integrations disabled.",
);
// npm.cmd cannot be spawned directly without a shell on Windows. Use the
// npm CLI JavaScript entry point supplied by `npm run` on every platform.
const npmCli = process.env.npm_execpath;
if (!npmCli || !existsSync(npmCli))
  throw new Error("Start this demo with: npm run dev:local");
const child = spawn(
  process.execPath,
  [npmCli, "run", "dev", "--", ...process.argv.slice(2)],
  {
    env,
    stdio: "inherit",
  },
);
child.on("error", () => {
  console.error("Could not start development server.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
