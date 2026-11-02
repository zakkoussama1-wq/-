import "@shopify/shopify-api/adapters/web-api";
import { ApiVersion, LogSeverity, shopifyApi } from "@shopify/shopify-api";
import { setAbstractFetchFunc } from "@shopify/shopify-api/runtime";
import { sessionMerchant } from "../../auth/store";
import { shopHostname } from "./client";

// Preserve the platform transport and TLS trust; never redirect OAuth secrets.
setAbstractFetchFunc((url, options) =>
  fetch(url, {
    ...options,
    redirect: "error",
    signal: options?.signal ?? AbortSignal.timeout(15000),
  }),
);

export const SHOPIFY_API_VERSION = ApiVersion.October26;
export const SHOPIFY_SCOPES = ["read_products"];
export const CALLBACK_PATH = "/api/integrations/shopify/callback";

export function shopifyConfiguration() {
  const redirect = new URL(process.env.SHOPIFY_REDIRECT_URI ?? "");
  if (
    redirect.protocol !== "https:" ||
    redirect.username ||
    redirect.password ||
    redirect.search ||
    redirect.hash ||
    redirect.pathname !== CALLBACK_PATH ||
    !process.env.SHOPIFY_CLIENT_ID ||
    !process.env.SHOPIFY_CLIENT_SECRET
  )
    throw new Error(
      "Shopify requires configured HTTPS application URLs and credentials.",
    );
  const authorizedShop = shopHostname(
    process.env.SHOPIFY_SHOP ?? "h8vsym-t0.myshopify.com",
  );
  return { redirect, origin: redirect.origin, authorizedShop };
}

// Lazy initialization keeps local-demo builds usable without Shopify credentials.
export function shopifySdk() {
  const { redirect } = shopifyConfiguration();
  return shopifyApi({
    apiKey: process.env.SHOPIFY_CLIENT_ID!,
    apiSecretKey: process.env.SHOPIFY_CLIENT_SECRET!,
    hostName: redirect.host,
    hostScheme: "https",
    apiVersion: SHOPIFY_API_VERSION,
    scopes: SHOPIFY_SCOPES,
    isEmbeddedApp: false,
    // Dev Dashboard distribution choice is separate from admin-created custom apps.
    isCustomStoreApp: false,
    logger: { level: LogSeverity.Error, httpRequests: false, log: () => {} },
  });
}

export function externalShopifyRequest(request: Request) {
  const incoming = new URL(request.url);
  return new Request(
    new URL(incoming.pathname + incoming.search, shopifyConfiguration().origin),
    {
      method: request.method,
      headers: request.headers,
    },
  );
}

export function integrationsDisabled() {
  return (
    process.env.DZ_LOCAL_DEMO === "1" ||
    process.env.DZ_DISABLE_EXTERNAL_INTEGRATIONS === "1"
  );
}

export async function shopifyMerchant(request: Request) {
  const token =
    request.headers
      .get("cookie")
      ?.match(/(?:^|; )dz_session=([a-f0-9]+)/)?.[1] ?? "";
  return sessionMerchant(token);
}
