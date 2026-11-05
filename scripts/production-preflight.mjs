// Validate configuration without logging values or connecting to external services.
const problems = [];
const bootstrap = process.env.DZ_BOOTSTRAP_MODE === "1";
if (![undefined, "0", "1"].includes(process.env.DZ_BOOTSTRAP_MODE))
  problems.push("DZ_BOOTSTRAP_MODE: use 0 or 1");
for (const name of [
  "DATABASE_URL",
  ...(!bootstrap
    ? ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET", "SHOPIFY_REDIRECT_URI"]
    : []),
  "INTEGRATIONS_ENCRYPTION_KEY",
])
  if (!process.env[name]) problems.push(`${name}: required`);
try {
  const db = new URL(process.env.DATABASE_URL ?? "");
  if (!["postgres:", "postgresql:"].includes(db.protocol)) throw new Error();
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(db.hostname) &&
    ((db.searchParams.has("sslmode") &&
      db.searchParams.get("sslmode") !== "verify-full") ||
      ["false", "0"].includes(db.searchParams.get("ssl") ?? ""))
  )
    throw new Error();
} catch {
  problems.push("DATABASE_URL: PostgreSQL with verified remote TLS required");
}
if (!bootstrap)
  try {
    const url = new URL(process.env.SHOPIFY_REDIRECT_URI ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/api/integrations/shopify/callback"
    )
      throw new Error();
  } catch {
    problems.push("SHOPIFY_REDIRECT_URI: valid HTTPS callback required");
  }
if (!/^[a-f0-9]{64}$/i.test(process.env.INTEGRATIONS_ENCRYPTION_KEY ?? ""))
  problems.push("INTEGRATIONS_ENCRYPTION_KEY: 64 hex characters required");
for (const name of ["DZ_LOCAL_DEMO", "DZ_AUTH_TEST_BYPASS"])
  if (process.env[name] === "1")
    problems.push(`${name}: forbidden in production`);
if (process.env.LOCAL_MERCHANT_ID)
  problems.push("LOCAL_MERCHANT_ID: production fallback forbidden");
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Production configuration shape valid; database connectivity and live Shopify authorization still require verification.",
  );
