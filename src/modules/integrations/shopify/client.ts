import { createHmac, timingSafeEqual } from "node:crypto";
export function shopHostname(shop: string) {
  const normalized = shop.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(normalized))
    throw new Error(
      "أدخل نطاق متجر myshopify.com صحيحًا دون مسار أو بروتوكول.",
    );
  return normalized;
}
export function verifyOAuthQuery(params: URLSearchParams, secret: string) {
  const hmac = params.get("hmac");
  if (!hmac || !secret || !/^[a-f0-9]{64}$/i.test(hmac)) return false;
  const entries = [...params.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .sort(([a], [b]) => a.localeCompare(b));
  if (new Set(entries.map(([k]) => k)).size !== entries.length) return false;
  const message = entries.map(([k, v]) => `${k}=${v}`).join("&");
  const expected = createHmac("sha256", secret).update(message).digest();
  return timingSafeEqual(expected, Buffer.from(hmac, "hex"));
}
export function oauthAuthorizeUrl(input: {
  shop: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}) {
  const shop = shopHostname(input.shop);
  const redirect = new URL(input.redirectUri);
  if (redirect.protocol !== "https:")
    throw new Error("عنوان OAuth يتطلب HTTPS.");
  if (!input.clientId || !input.state || !input.scopes.length)
    throw new Error("إعدادات OAuth ناقصة.");
  const params = new URLSearchParams({
    client_id: input.clientId,
    scope: input.scopes.join(","),
    redirect_uri: redirect.href,
    state: input.state,
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}
export async function exchangeShopifyToken(
  input: {
    shop: string;
    code: string;
    clientId: string;
    clientSecret: string;
  },
  transport: typeof fetch = fetch,
) {
  const shop = shopHostname(input.shop);
  if (!input.code || !input.clientId || !input.clientSecret)
    throw new Error("إعدادات تبادل الاعتماد ناقصة.");
  const r = await transport(`https://${shop}/admin/oauth/access_token`, {
    redirect: "error",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`رفض Shopify تبادل الاعتماد (HTTP ${r.status}).`);
  const data = await r.json();
  if (typeof data.access_token !== "string" || !data.access_token)
    throw new Error("استجابة اعتماد Shopify غير صالحة.");
  return { accessToken: data.access_token, scope: String(data.scope ?? "") };
}
export async function shopifyGraphql(
  shop: string,
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
  transport: typeof fetch = fetch,
) {
  shop = shopHostname(shop);
  if (!token) throw new Error("اعتماد المتجر غير متاح.");
  const response = await transport(
    `https://${shop}/admin/api/2026-10/graphql.json`,
    {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new Error(`تعذر طلب Shopify (HTTP ${response.status}).`);
  const result = await response.json();
  if (result.errors?.length || !result.data)
    throw new Error("رفض Shopify استعلام GraphQL.");
  return result.data;
}
