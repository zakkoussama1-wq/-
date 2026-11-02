import { authenticatedShopTenant } from "@/modules/merchants/local-context";
import { Session } from "@shopify/shopify-api";
import { connectionCredential } from "@/modules/integrations/shopify/connections";
import { registerUninstallWebhook } from "@/modules/integrations/shopify/lifecycle";
import {
  catalogSyncStatus,
  readShopifyCatalog,
} from "@/modules/integrations/shopify/catalog";
import {
  integrationsDisabled,
  shopifyConfiguration,
} from "@/modules/integrations/shopify/sdk";
export async function GET(request: Request) {
  if (integrationsDisabled())
    return Response.json({ error: "Shopify disabled" }, { status: 503 });
  try {
    const t = await authenticatedShopTenant(request);
    return Response.json(await catalogSyncStatus(t.merchantId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Verified Shopify session required" },
      { status: 401 },
    );
  }
}
export async function POST(request: Request) {
  if (integrationsDisabled())
    return Response.json({ error: "Shopify disabled" }, { status: 503 });
  try {
    if (request.headers.get("origin") !== shopifyConfiguration().origin)
      return Response.json({ error: "Origin rejected" }, { status: 403 });
    const t = await authenticatedShopTenant(request);
    const credential = await connectionCredential(t.merchantId);
    await registerUninstallWebhook(
      new Session({
        id: `offline_${credential.shop}`,
        shop: credential.shop,
        state: "",
        isOnline: false,
        accessToken: credential.accessToken,
      }),
    );
    const catalog = await readShopifyCatalog(t.merchantId, true);
    return Response.json(
      {
        synced: true,
        products: catalog.products.length,
        ...(await catalogSyncStatus(t.merchantId)),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        synced: false,
        error:
          "Shopify synchronization failed; check authorization, currency and retry.",
      },
      { status: 503 },
    );
  }
}
