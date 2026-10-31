import { localMerchantId } from "@/modules/merchants/local-context";
import {
  oauthAuthorizeUrl,
  shopHostname,
} from "@/modules/integrations/shopify/client";
import { createOAuthState } from "@/modules/integrations/shopify/connections";
export async function POST(request: Request) {
  if (process.env.DZ_DISABLE_EXTERNAL_INTEGRATIONS === "1")
    return Response.json(
      { error: "التكاملات الخارجية معطلة في التجربة المحلية." },
      { status: 503 },
    );
  const u = new URL(request.url);
  if (
    request.headers.get("origin") !==
    `${u.protocol}//${request.headers.get("host") ?? u.host}`
  )
    return Response.json({ error: "مصدر غير مسموح." }, { status: 403 });
  if (
    !process.env.SHOPIFY_CLIENT_ID ||
    !process.env.SHOPIFY_CLIENT_SECRET ||
    !process.env.SHOPIFY_REDIRECT_URI
  )
    return Response.json(
      { error: "إعدادات تطبيق Shopify وURL العودة غير متوفرة على الخادم." },
      { status: 503 },
    );
  try {
    const text = await request.text();
    if (text.length > 512) throw new Error("طلب كبير.");
    const input = JSON.parse(text);
    if (Object.keys(input).length !== 1 || typeof input.shop !== "string")
      throw new Error("أدخل نطاق المتجر فقط.");
    const shop = shopHostname(input.shop);
    const state = await createOAuthState(await localMerchantId(request), shop);
    const url = oauthAuthorizeUrl({
      shop,
      clientId: process.env.SHOPIFY_CLIENT_ID,
      redirectUri: process.env.SHOPIFY_REDIRECT_URI,
      state,
      scopes: ["read_products"],
    });
    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "تعذر بدء الربط." },
      { status: 400 },
    );
  }
}
