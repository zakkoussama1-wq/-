import { connectionStatus } from "@/modules/integrations/shopify/connections";
import {
  integrationsDisabled,
  shopifyConfiguration,
  shopifyMerchant,
} from "@/modules/integrations/shopify/sdk";
export async function GET(request: Request) {
  let configured = false;
  try {
    shopifyConfiguration();
    configured =
      !integrationsDisabled() &&
      /^[a-f0-9]{64}$/i.test(process.env.INTEGRATIONS_ENCRYPTION_KEY ?? "");
  } catch {
    /* Keep missing credentials out of responses. */
  }
  try {
    const merchant = await shopifyMerchant(request);
    if (!merchant)
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    return Response.json(
      {
        ...(await connectionStatus(merchant)),
        suggestedShop: process.env.SHOPIFY_SHOP ?? "",
        configured,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Unable to load connection status" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
