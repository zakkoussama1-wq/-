import type { Session } from "@shopify/shopify-api";
import { shopifyConfiguration, shopifySdk } from "./sdk";
import { shopHostname } from "./client";

export async function verifyShopSession(session: Session) {
  const client = new (shopifySdk().clients.Graphql)({ session });
  const result = await client.request<{
    shop: { id: string; name: string; myshopifyDomain: string };
  }>("query DzVerifyShop { shop { id name myshopifyDomain } }");
  if (
    result.errors ||
    !result.data?.shop ||
    shopHostname(result.data.shop.myshopifyDomain) !== session.shop
  )
    throw new Error("Shopify authenticated shop verification failed");
  return result.data.shop;
}

// Legacy installation requires shop-specific subscriptions rather than TOML subscriptions.
export async function registerUninstallWebhook(session: Session) {
  const client = new (shopifySdk().clients.Graphql)({ session });
  const uri = new URL("/api/shopify/webhooks", shopifyConfiguration().origin)
    .href;
  for (const topic of [
    "APP_UNINSTALLED",
    "PRODUCTS_CREATE",
    "PRODUCTS_UPDATE",
    "PRODUCTS_DELETE",
  ]) {
    const existing = await client.request<{
      webhookSubscriptions: { nodes: { id: string; uri: string }[] };
    }>(
      `query DzUninstallSubscriptions { webhookSubscriptions(first: 100, topics: [${topic}]) { nodes { id uri } } }`,
    );
    if (existing.errors || !existing.data)
      throw new Error("Cannot inspect webhook subscriptions");
    if (
      existing.data.webhookSubscriptions.nodes.some((node) => node.uri === uri)
    )
      continue;
    const result = await client.request<{
      webhookSubscriptionCreate: {
        webhookSubscription: { id: string } | null;
        userErrors: { message: string }[];
      };
    }>(
      `mutation DzRegisterUninstall($subscription: WebhookSubscriptionInput!) { webhookSubscriptionCreate(topic: ${topic}, webhookSubscription: $subscription) { webhookSubscription { id } userErrors { message } } }`,
      { variables: { subscription: { uri, format: "JSON" } } },
    );
    if (
      result.errors ||
      !result.data?.webhookSubscriptionCreate.webhookSubscription ||
      result.data.webhookSubscriptionCreate.userErrors.length
    )
      throw new Error("Cannot register uninstall webhook");
  }
}
