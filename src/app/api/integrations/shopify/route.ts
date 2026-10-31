import { localMerchantId } from "@/modules/merchants/local-context";
import { connectionStatus } from "@/modules/integrations/shopify/connections";
export async function GET(request: Request) {
  return Response.json(
    {
      ...(await connectionStatus(await localMerchantId(request))),
      suggestedShop: process.env.SHOPIFY_SHOP ?? "",
      configured: !!(
        process.env.SHOPIFY_CLIENT_ID &&
        process.env.SHOPIFY_CLIENT_SECRET &&
        process.env.SHOPIFY_REDIRECT_URI &&
        process.env.INTEGRATIONS_ENCRYPTION_KEY
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
