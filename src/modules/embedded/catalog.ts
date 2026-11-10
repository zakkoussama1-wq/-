import { Pool } from "pg";
import { postgresConfiguration } from "../storage/database";
import { catalogSchema } from "../checkout/schema";
/** Only the existing Shopify synchronization cache is a preview-product source.
 * Never initialize/read the independent local/demo product table or refresh OAuth. */
export async function embeddedCatalog(tenant: {
  merchantId: string;
  shopId: string;
}) {
  const pool = new Pool({
    ...postgresConfiguration(process.env.DATABASE_URL ?? ""),
    max: 1,
  });
  try {
    const db = await pool.connect();
    try {
      await db.query("BEGIN READ ONLY");
      const result = await db.query(
        "SELECT payload,shop_id FROM shopify_catalog WHERE merchant_id=$1",
        [tenant.merchantId],
      );
      await db.query("COMMIT");
      const row = result.rows[0];
      if (!row)
        return {
          products: [],
          discount: { type: "none" as const, value: 0 as const },
          revision: 0,
        };
      if (row.shop_id !== tenant.shopId)
        throw new Error("Shop cache binding mismatch");
      const catalog = catalogSchema.parse(JSON.parse(row.payload));
      return {
        ...catalog,
        products: catalog.products.filter(
          (p) =>
            /^gid:\/\/shopify\/Product\/[1-9][0-9]*$/.test(p.id) &&
            !p.demo &&
            p.active &&
            !p.deleted,
        ),
      };
    } finally {
      db.release();
    }
  } finally {
    await pool.end();
  }
}
