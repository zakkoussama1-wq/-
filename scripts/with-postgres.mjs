import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
const [command, ...args] = process.argv.slice(2);
if (!command)
  throw new Error("Usage: node scripts/with-postgres.mjs COMMAND [ARGS]");
const env = { ...process.env };
if (!env.DATABASE_URL) {
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
  env.DATABASE_URL = url.toString();
}
const child = spawn(command, args, { env, stdio: "inherit" });
child.on("error", () => {
  console.error("Could not launch command.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
