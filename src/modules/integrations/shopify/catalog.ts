import { Session } from "@shopify/shopify-api";
import { z } from "zod";
import { authDb } from "../../auth/store";
import { verifiedShopForMerchant } from "../../merchants/shops";
import { connectionCredential } from "./connections";
import { shopifySdk, integrationsDisabled } from "./sdk";
import { productSchema, type CheckoutCatalog } from "../../checkout/schema";

export const catalogTables = `CREATE TABLE IF NOT EXISTS shopify_catalog(merchant_id TEXT PRIMARY KEY REFERENCES accounts(merchant_id),shop_id TEXT NOT NULL,payload TEXT NOT NULL,synced_at TEXT NOT NULL,revision INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS shopify_catalog_dirty(merchant_id TEXT PRIMARY KEY REFERENCES accounts(merchant_id),dirty INTEGER NOT NULL DEFAULT 1,error TEXT NOT NULL DEFAULT '')`;
export function shopifyCatalogMode() {
  return (
    process.env.NODE_ENV === "production" ||
    (!integrationsDisabled() && process.env.DZ_SHOPIFY_MODE === "1")
  );
}
const image = z.object({
  url: z.url().refine((s) => new URL(s).protocol === "https:"),
});
const variant = z.object({
  id: z.string().regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/),
  title: z.string(),
  sku: z.string().nullable(),
  price: z.string(),
  inventoryQuantity: z.number().int().nullable(),
  inventoryPolicy: z.enum(["DENY", "CONTINUE"]),
  image: image.nullable(),
  selectedOptions: z.array(z.object({ name: z.string(), value: z.string() })),
});
const connection = z.object({
  nodes: z.array(variant),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    endCursor: z.string().nullable(),
  }),
});
const product = z.object({
  id: z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/),
  title: z.string(),
  description: z.string(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED", "UNLISTED"]),
  images: z.object({ nodes: z.array(image) }),
  variants: connection,
});
const fields = `id title sku price inventoryQuantity inventoryPolicy image { url } selectedOptions { name value }`;
const productsQuery = `query DzCatalog($after:String) { shop { id currencyCode } products(first:100,after:$after) { nodes { id title description status images(first:12) { nodes { url } } variants(first:100) { nodes { ${fields} } pageInfo { hasNextPage endCursor } } } pageInfo { hasNextPage endCursor } } }`;
const variantsQuery = `query DzCatalogVariants($id:ID!,$after:String) { product(id:$id) { variants(first:100,after:$after) { nodes { ${fields} } pageInfo { hasNextPage endCursor } } } }`;
export function priceMinor(price: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(price))
    throw new Error("Unsupported Shopify price precision");
  const [whole, fraction = ""] = price.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 1000000000)
    throw new Error("Shopify price outside supported range");
  return amount;
}
function nextCursor(
  info: { hasNextPage: boolean; endCursor: string | null },
  seen: Set<string>,
) {
  if (!info.hasNextPage) return undefined;
  if (!info.endCursor || seen.has(info.endCursor))
    throw new Error("Invalid Shopify pagination");
  seen.add(info.endCursor);
  return info.endCursor;
}
export async function readShopifyCatalog(
  merchant: string,
  force = false,
): Promise<CheckoutCatalog> {
  if (integrationsDisabled()) throw new Error("Shopify disabled in local demo");
  const tenant = await verifiedShopForMerchant(merchant);
  const credential = await connectionCredential(merchant);
  if (credential.shop !== tenant.domain)
    throw new Error("Shop identity mismatch");
  const db = await authDb();
  try {
    await db.exec(catalogTables);
    await db.exec("BEGIN IMMEDIATE");
    await db.lock(`shopify-catalog:${merchant}`);
    const previous = await db
      .prepare("SELECT * FROM shopify_catalog WHERE merchant_id=?")
      .get(merchant);
    const dirty = await db
      .prepare("SELECT dirty FROM shopify_catalog_dirty WHERE merchant_id=?")
      .get(merchant);
    if (
      !force &&
      previous &&
      previous.shop_id === tenant.shopId &&
      !dirty?.dirty &&
      Date.now() - Date.parse(String(previous.synced_at)) < 60000
    ) {
      const result = JSON.parse(String(previous.payload));
      await db.exec("COMMIT");
      return result;
    }
    const session = new Session({
      id: `offline_${tenant.domain}`,
      shop: tenant.domain,
      state: "",
      isOnline: false,
      accessToken: credential.accessToken,
    });
    const client = new (shopifySdk().clients.Graphql)({ session });
    const all: z.infer<typeof product>[] = [],
      cursors = new Set<string>();
    let after: string | undefined;
    do {
      const response = await client.request(productsQuery, {
        variables: { after },
      });
      if (response.errors) throw new Error("Shopify catalog request failed");
      const page = z
        .object({
          shop: z.object({ id: z.string(), currencyCode: z.string() }),
          products: z.object({
            nodes: z.array(product),
            pageInfo: z.object({
              hasNextPage: z.boolean(),
              endCursor: z.string().nullable(),
            }),
          }),
        })
        .parse(response.data);
      if (page.shop.id !== tenant.shopId || page.shop.currencyCode !== "DZD")
        throw new Error("Shop identity or DZD currency mismatch");
      for (const p of page.products.nodes) {
        const seen = new Set<string>();
        let cursor = nextCursor(p.variants.pageInfo, seen);
        while (cursor) {
          const more = await client.request(variantsQuery, {
            variables: { id: p.id, after: cursor },
          });
          if (more.errors) throw new Error("Shopify variant request failed");
          const data = z
            .object({ product: z.object({ variants: connection }) })
            .parse(more.data);
          p.variants.nodes.push(...data.product.variants.nodes);
          if (p.variants.nodes.length > 2048)
            throw new Error("Too many variants");
          cursor = nextCursor(data.product.variants.pageInfo, seen);
        }
        all.push(p);
      }
      if (all.length > 100000) throw new Error("Catalog safety limit exceeded");
      after = nextCursor(page.products.pageInfo, cursors);
    } while (after);
    if (new Set(all.map((p) => p.id)).size !== all.length)
      throw new Error("Duplicate Shopify products");
    const revision = Number(previous?.revision ?? 0) + 1;
    const result: CheckoutCatalog = {
      revision,
      discount: { type: "none", value: 0 },
      products: all.map((p) =>
        productSchema.parse({
          id: p.id,
          name: p.title,
          demo: false,
          active: p.status === "ACTIVE" || p.status === "UNLISTED",
          description: p.description,
          images: [...new Set(p.images.nodes.map((i) => i.url))],
          imageUrl: p.images.nodes[0]?.url,
          variants: p.variants.nodes.map((v) => ({
            id: v.id,
            name: v.title,
            sku: v.sku || undefined,
            imageUrl: v.image?.url,
            priceMinor: priceMinor(v.price),
            stock:
              v.inventoryPolicy === "CONTINUE"
                ? null
                : v.inventoryQuantity === null
                  ? null
                  : Math.max(0, v.inventoryQuantity),
            selectedOptions: v.selectedOptions,
          })),
        }),
      ),
    };
    await db
      .prepare(
        "INSERT INTO shopify_catalog VALUES(?,?,?,?,?) ON CONFLICT(merchant_id) DO UPDATE SET shop_id=excluded.shop_id,payload=excluded.payload,synced_at=excluded.synced_at,revision=excluded.revision",
      )
      .run(
        merchant,
        tenant.shopId,
        JSON.stringify(result),
        new Date().toISOString(),
        revision,
      );
    await db
      .prepare(
        "INSERT INTO shopify_catalog_dirty VALUES(?,0,'') ON CONFLICT(merchant_id) DO UPDATE SET dirty=0,error=''",
      )
      .run(merchant);
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    await db.exec("ROLLBACK");
    await db
      .prepare(
        "INSERT INTO shopify_catalog_dirty VALUES(?,1,'sync_failed') ON CONFLICT(merchant_id) DO UPDATE SET dirty=1,error='sync_failed'",
      )
      .run(merchant);
    throw error;
  } finally {
    await db.close();
  }
}
export async function invalidateShopifyCatalog(
  domain: string,
  webhookId: string,
  hash: string,
) {
  const db = await authDb();
  try {
    await db.exec(catalogTables);
    await db.exec("BEGIN IMMEDIATE");
    const shop = await db
      .prepare(
        "SELECT merchant_id FROM shopify_shops WHERE domain=? AND active=1",
      )
      .get(domain);
    if (shop) {
      const merchant = String(shop.merchant_id);
      await db.lock(`shopify-catalog:${merchant}`);
      const exists = await db
        .prepare(
          "SELECT 1 FROM shopify_webhook_receipts WHERE shop=? AND webhook_id=?",
        )
        .get(domain, webhookId);
      if (!exists) {
        await db
          .prepare(
            "INSERT INTO shopify_catalog_dirty VALUES(?,1,'') ON CONFLICT(merchant_id) DO UPDATE SET dirty=1",
          )
          .run(merchant);
        await db
          .prepare("INSERT INTO shopify_webhook_receipts VALUES(?,?,?,?)")
          .run(domain, webhookId, hash, new Date().toISOString());
      }
    }
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}
export async function catalogSyncStatus(merchant: string) {
  await verifiedShopForMerchant(merchant);
  const db = await authDb();
  try {
    await db.exec(catalogTables);
    const row = await db
      .prepare(
        "SELECT synced_at,revision FROM shopify_catalog WHERE merchant_id=?",
      )
      .get(merchant);
    const state = await db
      .prepare(
        "SELECT dirty,error FROM shopify_catalog_dirty WHERE merchant_id=?",
      )
      .get(merchant);
    return {
      source: "shopify",
      lastSyncedAt: row?.synced_at ?? null,
      revision: Number(row?.revision ?? 0),
      needsSync: !row || !!state?.dirty,
      error: state?.error || null,
    };
  } finally {
    await db.close();
  }
}
