import { z } from "zod";
import { Pool } from "pg";
import { postgresConfiguration } from "../storage/database";
import {
  integrationsDisabled,
  shopifySdk,
  shopifyConfiguration,
} from "../integrations/shopify/sdk";
import { shopHostname } from "../integrations/shopify/client";
export class EmbeddedError extends Error {
  constructor(
    public code: string,
    public status = 401,
  ) {
    super(code);
  }
}
const claims = z.object({
  aud: z.string(),
  dest: z.string(),
  iss: z.string(),
  sub: z.string().regex(/^[1-9][0-9]*$/),
  exp: z.number().int(),
  nbf: z.number().int(),
  iat: z.number().int(),
  sid: z.string().min(1).max(200),
});
/** Session tokens never leave request memory and are never persisted or logged. */
export async function embeddedTenant(request: Request) {
  if (process.env.DZ_SHOPIFY_EMBEDDED !== "1" || integrationsDisabled())
    throw new EmbeddedError("EMBEDDED_DISABLED", 503);
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_.-]{40,4096}$/.test(authorization))
    throw new EmbeddedError("EMBEDDED_SESSION_REQUIRED");
  let sdk: ReturnType<typeof shopifySdk>;
  try {
    sdk = shopifySdk(true);
  } catch {
    throw new EmbeddedError("EMBEDDED_CONFIGURATION_REQUIRED", 503);
  }
  if (!process.env.DATABASE_URL)
    throw new EmbeddedError("POSTGRES_REQUIRED", 503);
  let shop: string;
  try {
    const value = claims.parse(
      await sdk.session.decodeSessionToken(authorization.slice(7), {
        checkAudience: true,
      }),
    );
    const dest = new URL(value.dest);
    shop = shopHostname(dest.hostname);
    const now = Math.floor(Date.now() / 1000);
    if (
      dest.origin !== `https://${shop}` ||
      !["", "/"].includes(dest.pathname) ||
      dest.search ||
      dest.hash ||
      dest.username ||
      dest.password ||
      value.iss !== `https://${shop}/admin` ||
      value.aud !== process.env.SHOPIFY_CLIENT_ID ||
      value.iat > now + 10 ||
      value.exp <= now - 10 ||
      value.exp <= value.iat ||
      value.exp - value.iat > 120
    )
      throw new Error();
  } catch {
    // SDK errors can contain the JWT: always replace them, never serialize/log.
    throw new EmbeddedError("EMBEDDED_SESSION_INVALID");
  }
  const params = new URL(request.url).searchParams;
  if (
    ["store", "shop", "merchant", "merchantId"].some((key) => params.has(key))
  )
    throw new EmbeddedError("TENANT_SELECTOR_FORBIDDEN", 403);
  const pool = new Pool({
    ...postgresConfiguration(process.env.DATABASE_URL ?? ""),
    max: 1,
  });
  try {
    const db = await pool.connect();
    try {
      await db.query("BEGIN READ ONLY");
      const result = await db.query(
        "SELECT s.merchant_id,s.shop_id,s.domain FROM shopify_shops s JOIN shopify_connections c ON c.merchant_id=s.merchant_id AND c.shop=s.domain WHERE s.domain=$1 AND s.active=1",
        [shop],
      );
      await db.query("COMMIT");
      if (result.rows.length !== 1)
        throw new EmbeddedError("SHOPIFY_CONNECTION_REQUIRED", 403);
      return {
        merchantId: String(result.rows[0].merchant_id),
        shopId: String(result.rows[0].shop_id),
        domain: shop,
      };
    } finally {
      db.release();
    }
  } finally {
    await pool.end();
  }
}
export function embeddedMutationOrigin(request: Request) {
  if (
    request.headers.get("origin") !== shopifyConfiguration().origin ||
    (request.headers.has("sec-fetch-site") &&
      request.headers.get("sec-fetch-site") !== "same-origin")
  )
    throw new EmbeddedError("ORIGIN_DENIED", 403);
}
