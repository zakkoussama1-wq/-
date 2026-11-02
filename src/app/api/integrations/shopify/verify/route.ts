import { Session } from "@shopify/shopify-api";
import { connectionCredential } from "@/modules/integrations/shopify/connections";
import {
  integrationsDisabled,
  shopifyMerchant,
} from "@/modules/integrations/shopify/sdk";
import { verifyShopSession } from "@/modules/integrations/shopify/lifecycle";

export async function GET(request: Request) {
  if (integrationsDisabled())
    return Response.json(
      { error: "Local demo: external integrations disabled" },
      { status: 503 },
    );
  const merchant = await shopifyMerchant(request);
  if (!merchant)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    const { shop, accessToken } = await connectionCredential(merchant);
    const verified = await verifyShopSession(
      new Session({
        id: `offline_${shop}`,
        shop,
        state: "",
        isOnline: false,
        accessToken,
      }),
    );
    return Response.json(
      { verified: true, shop: verified, checkedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        verified: false,
        error: "Shopify verification failed; reconnect or check configuration.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
