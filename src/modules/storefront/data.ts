import { Pool } from "pg";
import { Session } from "@shopify/shopify-api";
import { z } from "zod";
import { postgresConfiguration } from "../storage/database";
import { inspectOfflineCredential } from "../integrations/shopify/connections";
import { formSettingsSchema, defaultFormSettings } from "../forms/settings";
import { productFormSettings } from "../forms/product-form";
import { discountSchema, type CheckoutCatalog } from "../checkout/schema";
import { entrySchema, type ShippingState } from "../shipping/schema";
import { priceMinor } from "../integrations/shopify/catalog";
import { StorefrontError } from "./context";
export async function readStorefrontData(shop: string, productId: string) {
  const pool = new Pool({
    ...postgresConfiguration(process.env.DATABASE_URL ?? ""),
    max: 1,
  });
  let merchant = "",
    shopId = "",
    accessToken = "";
  let settings = defaultFormSettings;
  let shipping: ShippingState = {
    mode: "legacy58",
    revision: 0,
    genericOffice: false,
    entries: [],
  };
  let discount = discountSchema.parse({ type: "none", value: 0 }),
    revision = 0;
  try {
    const db = await pool.connect();
    try {
      await db.query("BEGIN READ ONLY");
      const result = await db.query(
        "SELECT s.merchant_id,s.shop_id,c.encrypted_token,m.encrypted_session FROM shopify_shops s JOIN shopify_connections c ON c.merchant_id=s.merchant_id AND c.shop=s.domain LEFT JOIN shopify_session_metadata m ON m.merchant_id=s.merchant_id WHERE s.domain=$1 AND s.active=1",
        [shop],
      );
      const row = result.rows[0];
      if (!row) throw new StorefrontError("STORE_NOT_INSTALLED", 404);
      merchant = row.merchant_id;
      shopId = row.shop_id;
      try {
        const credential = inspectOfflineCredential(
          merchant,
          shop,
          row.encrypted_token,
          row.encrypted_session,
        );
        if (
          !new Session({
            id: "storefront-scope",
            shop,
            state: "",
            isOnline: false,
            scope: credential.scope,
          }).isScopeIncluded(["read_products"])
        )
          throw new Error();
        accessToken = credential.accessToken;
      } catch {
        throw new StorefrontError("CATALOG_AUTH_UNAVAILABLE");
      }
      const design = await db.query(
        "SELECT settings FROM form_settings WHERE merchant_id=$1",
        [merchant],
      );
      settings = productFormSettings(
        design.rows[0]
          ? formSettingsSchema.parse(JSON.parse(design.rows[0].settings))
          : defaultFormSettings,
        productId,
      );
      settings = {
        ...settings,
        administrativeMode: "legacy58",
        elements: { ...settings.elements, geography: true, method: true },
        contact: { name: "required", phone: "required", address: "required" },
      };
      const rules = await db.query(
        "SELECT scope,target,rule_json FROM shipping_rules WHERE merchant_id=$1 AND mode='legacy58' ORDER BY scope,target",
        [merchant],
      );
      const shippingSettings = await db.query(
        "SELECT revision,generic_office FROM shipping_settings WHERE merchant_id=$1 AND mode='legacy58'",
        [merchant],
      );
      shipping = {
        mode: "legacy58",
        revision: Number(shippingSettings.rows[0]?.revision ?? 0),
        genericOffice: shippingSettings.rows[0]?.generic_office === 1,
        entries: rules.rows.map((r) =>
          entrySchema.parse({
            scope: r.scope,
            target: r.target,
            rule: JSON.parse(r.rule_json),
          }),
        ),
      };
      const discounts = await db.query(
        "SELECT revision,discount_json FROM checkout_settings WHERE merchant_id=$1",
        [merchant],
      );
      if (discounts.rows[0]) {
        discount = discountSchema.parse(
          JSON.parse(discounts.rows[0].discount_json),
        );
        revision = Number(discounts.rows[0].revision);
      }
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  } finally {
    await pool.end();
  }
  const variantSchema = z.object({
    id: z.string().regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/),
    title: z.string(),
    price: z.string(),
    inventoryQuantity: z.number().int().nullable(),
    image: z.object({ url: z.url() }).nullable(),
    selectedOptions: z.array(z.object({ name: z.string(), value: z.string() })),
  });
  const connection = z.object({
    nodes: z.array(variantSchema),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      endCursor: z.string().nullable(),
    }),
  });
  const header = z.object({
    shop: z.object({
      id: z.string(),
      currencyCode: z.string(),
      primaryDomain: z.object({ url: z.url() }),
    }),
    product: z
      .object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        onlineStoreUrl: z.url().nullable(),
        featuredImage: z.object({ url: z.url() }).nullable(),
        variants: connection,
      })
      .nullable(),
  });
  const graph = async (query: string, variables: Record<string, unknown>) => {
    const response = await fetch(
      `https://${shop}/admin/api/2026-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables }),
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (
      !response.ok ||
      response.headers.get("x-shopify-api-version") !== "2026-10"
    )
      throw new StorefrontError("CATALOG_UNAVAILABLE");
    const body = await response.json();
    if (body.errors?.length || !body.data)
      throw new StorefrontError("CATALOG_UNAVAILABLE");
    return body.data;
  };
  const fields =
    "id title price inventoryQuantity image { url } selectedOptions { name value }";
  const initial = header.parse(
    await graph(
      `query DzStorefrontProduct($id:ID!) { shop { id currencyCode primaryDomain { url } } product(id:$id) { id title status onlineStoreUrl featuredImage { url } variants(first:100) { nodes { ${fields} } pageInfo { hasNextPage endCursor } } } }`,
      { id: productId },
    ),
  );
  if (initial.shop.id !== shopId || initial.shop.currencyCode !== "DZD")
    throw new StorefrontError("STORE_CURRENCY_UNSUPPORTED");
  const product = initial.product;
  if (
    !product ||
    product.id !== productId ||
    product.status !== "ACTIVE" ||
    !product.onlineStoreUrl
  )
    throw new StorefrontError("PRODUCT_UNAVAILABLE", 404);
  const origins = [
    `https://${shop}`,
    new URL(initial.shop.primaryDomain.url).origin,
  ];
  if (
    origins.some((o) => !o.startsWith("https://")) ||
    !origins.includes(new URL(product.onlineStoreUrl).origin)
  )
    throw new StorefrontError("PRODUCT_UNAVAILABLE", 404);
  let page = product.variants;
  const variants = [...page.nodes],
    seen = new Set<string>();
  while (page.pageInfo.hasNextPage) {
    const cursor = page.pageInfo.endCursor;
    if (!cursor || seen.has(cursor) || variants.length >= 2048)
      throw new StorefrontError("PRODUCT_VARIANTS_UNSUPPORTED");
    seen.add(cursor);
    const next = await graph(
      `query DzStorefrontVariants($id:ID!,$after:String!){product(id:$id){variants(first:100,after:$after){nodes{${fields}} pageInfo{hasNextPage endCursor}}}}`,
      { id: productId, after: cursor },
    );
    page = connection.parse(next.product?.variants);
    variants.push(...page.nodes);
  }
  if (
    !variants.length ||
    variants.length > 2048 ||
    new Set(variants.map((v) => v.id)).size !== variants.length
  )
    throw new StorefrontError("PRODUCT_VARIANTS_UNSUPPORTED");
  const catalog: CheckoutCatalog = {
    revision,
    discount,
    products: [
      {
        id: product.id,
        name: product.title,
        active: true,
        demo: false,
        imageUrl: product.featuredImage?.url,
        variants: variants.map((v) => ({
          id: v.id,
          name: v.title,
          priceMinor: priceMinor(v.price),
          stock:
            v.inventoryQuantity === null
              ? null
              : Math.max(0, v.inventoryQuantity),
          imageUrl: v.image?.url,
          selectedOptions: v.selectedOptions,
        })),
      },
    ],
  };
  return {
    merchant,
    settings,
    shipping,
    catalog,
    origins,
  };
}
