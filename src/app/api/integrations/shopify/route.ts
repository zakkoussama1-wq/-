import { localMerchantId } from "@/modules/merchants/local-context";
import { connectionStatus } from "@/modules/integrations/shopify/connections";
import {
  integrationsDisabled,
  shopifyConfiguration,
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
  return Response.json(
    {
      ...(await connectionStatus(await localMerchantId(request))),
      suggestedShop: process.env.SHOPIFY_SHOP ?? "",
      configured,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
