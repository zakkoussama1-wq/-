import { Pool } from "pg";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL required. Stop writes and back up all SQLite databases before migration.",
  );
const files = [
  {
    file: process.env.AUTH_DATABASE_PATH ?? "data/auth.sqlite",
    tables: [
      "owner",
      "accounts",
      "shopify_shops",
      "tenant_secrets",
      "sessions",
      "auth_limits",
      "form_settings",
      "shopify_states",
      "shopify_connections",
      "shopify_session_metadata",
      "shopify_webhook_receipts",
    ],
  },
  {
    file: process.env.CHECKOUT_DATABASE_PATH ?? "data/checkout.sqlite",
    tables: ["checkout_settings", "checkout_products"],
  },
  {
    file: process.env.SHIPPING_DATABASE_PATH ?? "data/shipping.sqlite",
    tables: ["shipping_settings", "shipping_rules"],
  },
  {
    file: process.env.ORDERS_DATABASE_PATH ?? "data/orders.sqlite",
    tables: ["orders", "submission_limits"],
  },
];
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
let begun = false;
try {
  await client.query("BEGIN");
  begun = true;
  await client.query("SELECT pg_advisory_xact_lock(184488)");
  await client.query(
    readFileSync(new URL("./postgres-schema.sql", import.meta.url), "utf8"),
  );
  for (const { tables } of files)
    for (const table of tables) {
      const r = await client.query(`SELECT COUNT(*) AS count FROM ${table}`);
      if (Number(r.rows[0].count) !== 0)
        throw new Error(
          "Target is not empty; migration refused to overwrite existing data.",
        );
    }
  let copied = 0;
  for (const { file, tables } of files) {
    if (!existsSync(file)) continue;
    const source = new DatabaseSync(file, { readOnly: true });
    try {
      source.exec("BEGIN");
      for (const table of tables) {
        if (
          !source
            .prepare(
              "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
            )
            .get(table)
        )
          continue;
        const rows = source.prepare(`SELECT * FROM ${table}`).all();
        for (const row of rows) {
          const columns = Object.keys(row);
          if (columns.some((c) => !/^\w+$/.test(c)))
            throw new Error("Unexpected source columns.");
          const params = columns.map((_, i) => `$${i + 1}`).join(",");
          await client.query(
            `INSERT INTO ${table}(${columns.map((c) => '"' + c + '"').join(",")}) VALUES(${params})`,
            Object.values(row),
          );
          copied++;
        }
        const check = await client.query(
          `SELECT COUNT(*) AS count FROM ${table}`,
        );
        if (Number(check.rows[0].count) !== rows.length)
          throw new Error("Row count verification failed.");
      }
      source.exec("COMMIT");
    } finally {
      source.close();
    }
  }
  await client.query("COMMIT");
  begun = false;
  console.log(
    `Migration verified: ${copied} rows copied. Original SQLite files were retained.`,
  );
} catch (e) {
  if (begun) await client.query("ROLLBACK");
  console.error(e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
