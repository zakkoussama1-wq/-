import { createHash } from "node:crypto";
import type { WebhookValidation } from "@shopify/shopify-api";
import {
  shopifySdk,
  integrationsDisabled,
} from "@/modules/integrations/shopify/sdk";
import { shopHostname } from "@/modules/integrations/shopify/client";
import { uninstallConnection } from "@/modules/integrations/shopify/connections";
import { invalidateShopifyCatalog } from "@/modules/integrations/shopify/catalog";

export async function POST(request: Request) {
  if (integrationsDisabled()) return new Response(null, { status: 503 });
  // Bound the original bytes before HMAC validation and before parsing JSON.
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 262144) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  let validation: WebhookValidation;
  try {
    validation = await shopifySdk().webhooks.validate({
      rawBody: bytes.toString("utf8"),
      rawRequest: request,
    });
  } catch {
    return new Response(null, { status: 503 });
  }
  if (!validation.valid) return new Response(null, { status: 401 });
  if (
    ["PRODUCTS_CREATE", "PRODUCTS_UPDATE", "PRODUCTS_DELETE"].includes(
      validation.topic,
    )
  ) {
    try {
      const shop = shopHostname(validation.domain);
      const payload = JSON.parse(bytes.toString("utf8"));
      if (
        !Number.isSafeInteger(payload.id) ||
        payload.id <= 0 ||
        !validation.webhookId ||
        validation.webhookId.length > 200
      )
        return new Response(null, { status: 400 });
      await invalidateShopifyCatalog(
        shop,
        validation.webhookId,
        createHash("sha256").update(bytes).digest("hex"),
      );
      return new Response(null, { status: 200 });
    } catch {
      return new Response(null, { status: 503 });
    }
  }
  if (validation.topic !== "APP_UNINSTALLED")
    return new Response(null, { status: 400 });
  try {
    const shop = shopHostname(validation.domain);
    const payload = JSON.parse(bytes.toString("utf8"));
    const triggered = new Date(validation.triggeredAt ?? "");
    if (
      payload.myshopify_domain !== shop ||
      !Number.isFinite(triggered.getTime()) ||
      triggered.getTime() > Date.now() + 300000 ||
      !validation.webhookId ||
      validation.webhookId.length > 200
    )
      return new Response(null, { status: 400 });
    await uninstallConnection(
      shop,
      validation.webhookId,
      createHash("sha256").update(bytes).digest("hex"),
      triggered.toISOString(),
    );
    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 500 });
  }
}
