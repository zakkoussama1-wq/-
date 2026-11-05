// Shared by production preflight, application storage and readiness checks.
// Never include connection strings or credentials in configuration errors.
export function postgresConfiguration(url) {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol))
    throw new Error("PostgreSQL URL required");
  const mode = process.env.DATABASE_SSL_MODE ?? "verify-full";
  if (!["verify-full", "render-internal"].includes(mode))
    throw new Error("Unsupported DATABASE_SSL_MODE");
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    parsed.hostname,
  );
  let ssl;
  if (mode === "render-internal") {
    // Explicit opt-in only, on Render's runtime and private short DNS name.
    // Never downgrade external onrender.com endpoints or arbitrary remote hosts.
    if (
      process.env.RENDER !== "true" ||
      !/^dpg-[a-z0-9]+-[a-z]$/.test(parsed.hostname) ||
      (parsed.port && parsed.port !== "5432")
    )
      throw new Error(
        "render-internal requires Render private PostgreSQL hostname",
      );
    if (
      [...parsed.searchParams.keys()].some((key) =>
        /^(ssl|sslmode|sslcert|sslkey|sslrootcert|uselibpqcompat)$/i.test(key),
      )
    )
      throw new Error(
        "Remove conflicting SSL URL parameters for render-internal",
      );
    // Private-network PostgreSQL transport, not unverified TLS.
    ssl = false;
  } else if (!local) {
    if (
      ["disable", "no-verify"].includes(
        parsed.searchParams.get("sslmode") ?? "",
      ) ||
      ["false", "0"].includes(parsed.searchParams.get("ssl") ?? "")
    )
      throw new Error("Remote PostgreSQL must verify TLS.");
    parsed.searchParams.delete("ssl");
    parsed.searchParams.set("sslmode", "verify-full");
    ssl = { rejectUnauthorized: true };
  }
  return {
    connectionString: parsed.toString(),
    max: 10,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    ...(ssl !== undefined ? { ssl } : {}),
  };
}
