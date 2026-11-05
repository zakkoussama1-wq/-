import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { shopifySdk, integrationsDisabled } from "../integrations/shopify/sdk";
import { shopHostname } from "../integrations/shopify/client";
export class StorefrontError extends Error {
  constructor(
    public code: string,
    public status = 503,
  ) {
    super(code);
  }
}
export const productIdSchema = z
  .string()
  .max(100)
  .regex(/^gid:\/\/shopify\/Product\/[1-9][0-9]*$/);
export async function proxyShop(request: Request) {
  if (integrationsDisabled())
    throw new StorefrontError("STOREFRONT_DISABLED", 503);
  const url = new URL(request.url);
  for (const key of [
    "shop",
    "signature",
    "timestamp",
    "product",
    "origin",
    "wilaya",
  ])
    if (url.searchParams.getAll(key).length > 1)
      throw new StorefrontError("PROXY_INVALID", 401);
  try {
    if (
      !(await shopifySdk().utils.validateHmac(url.searchParams, {
        signator: "appProxy",
      }))
    )
      throw new Error();
    return shopHostname(url.searchParams.get("shop") ?? "");
  } catch {
    throw new StorefrontError("PROXY_INVALID", 401);
  }
}
const contextSchema = z
  .object({
    shop: z.string(),
    product: productIdSchema,
    origin: z.url(),
    expires: z.number().int(),
    nonce: z.string().regex(/^[a-f0-9]{48}$/),
  })
  .strict();
function mac(payload: string) {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) throw new StorefrontError("STOREFRONT_UNAVAILABLE");
  return createHmac("sha256", secret)
    .update("dz-cod-storefront-v1:" + payload)
    .digest();
}
export function createContext(shop: string, product: string, origin: string) {
  const payload = Buffer.from(
    JSON.stringify({
      shop,
      product,
      origin,
      expires: Date.now() + 10 * 60000,
      nonce: randomBytes(24).toString("hex"),
    }),
  ).toString("base64url");
  return payload + "." + mac(payload).toString("base64url");
}
export function verifyContext(
  value: string,
  shop: string,
  product: string,
  origin: string | null,
) {
  try {
    if (value.length > 2048) throw new Error();
    const [payload, signature, ...extra] = value.split(".");
    if (extra.length || !payload || !signature) throw new Error();
    const actual = Buffer.from(signature, "base64url"),
      expected = mac(payload);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new Error();
    const parsed = contextSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    if (
      parsed.shop !== shop ||
      parsed.product !== product ||
      parsed.expires <= Date.now() ||
      parsed.expires > Date.now() + 10 * 60000 ||
      (origin && origin !== parsed.origin)
    )
      throw new Error();
    return parsed;
  } catch {
    throw new StorefrontError("CONTEXT_EXPIRED_OR_INVALID", 403);
  }
}
