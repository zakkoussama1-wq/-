import {
  CALLBACK_PATH,
  externalShopifyRequest,
  integrationsDisabled,
  shopifyConfiguration,
  shopifyMerchant,
  shopifySdk,
} from "@/modules/integrations/shopify/sdk";
import { shopHostname } from "@/modules/integrations/shopify/client";
import { createOAuthState } from "@/modules/integrations/shopify/connections";
export async function POST(request: Request) {
  if (integrationsDisabled())
    return Response.json(
      { error: "التكاملات الخارجية معطلة في التجربة المحلية." },
      { status: 503 },
    );
  const merchant = await shopifyMerchant(request);
  if (!merchant)
    return Response.json({ error: "يلزم تسجيل الدخول." }, { status: 401 });
  let origin: string;
  try {
    origin = shopifyConfiguration().origin;
  } catch {
    return Response.json(
      { error: "Shopify HTTPS configuration missing" },
      { status: 503 },
    );
  }
  if (request.headers.get("origin") !== origin)
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
    if (
      process.env.SHOPIFY_SHOP &&
      shop !== shopHostname(process.env.SHOPIFY_SHOP)
    )
      return Response.json(
        { error: "المتجر غير مصرح به لهذه التجربة." },
        { status: 403 },
      );
    const response: Response = await shopifySdk().auth.begin({
      shop,
      callbackPath: CALLBACK_PATH,
      isOnline: false,
      rawRequest: externalShopifyRequest(request),
    });
    const url = response.headers.get("location");
    if (!url) throw new Error("OAuth could not start");
    await createOAuthState(
      merchant,
      shop,
      new URL(url).searchParams.get("state") ?? "",
    );
    const headers = new Headers({ "Cache-Control": "no-store" });
    for (const cookie of response.headers.getSetCookie())
      headers.append("Set-Cookie", cookie);
    return Response.json({ url }, { headers });
  } catch {
    return Response.json(
      {
        error: "تعذر بدء الربط. تحقق من إعدادات التطبيق وHTTPS ومفتاح التشفير.",
      },
      { status: 400 },
    );
  }
}
