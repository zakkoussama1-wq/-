import {
  verifyOAuthQuery,
  shopHostname,
  exchangeShopifyToken,
} from "@/modules/integrations/shopify/client";
import {
  consumeOAuthState,
  saveConnection,
} from "@/modules/integrations/shopify/connections";
export async function GET(request: Request) {
  if (process.env.DZ_DISABLE_EXTERNAL_INTEGRATIONS === "1")
    return Response.json(
      { error: "التكاملات الخارجية معطلة في التجربة المحلية." },
      { status: 503 },
    );
  const url = new URL(request.url);
  const p = url.searchParams;
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret || !process.env.SHOPIFY_CLIENT_ID)
    return Response.json({ error: "التطبيق غير مُعد للربط." }, { status: 503 });
  try {
    const timestamp = Number(p.get("timestamp"));
    if (
      !Number.isFinite(timestamp) ||
      Math.abs(Date.now() / 1000 - timestamp) > 300 ||
      !verifyOAuthQuery(p, secret)
    )
      return Response.json(
        { error: "تعذر التحقق من توقيع Shopify أو انتهت صلاحية الطلب." },
        { status: 400 },
      );
    const shop = shopHostname(p.get("shop") ?? "");
    const merchant = await consumeOAuthState(p.get("state") ?? "", shop);
    const token = await exchangeShopifyToken({
      shop,
      code: p.get("code") ?? "",
      clientId: process.env.SHOPIFY_CLIENT_ID,
      clientSecret: secret,
    });
    await saveConnection(merchant, shop, token.accessToken, token.scope);
    return Response.redirect(new URL("/dashboard", url.origin), 303);
  } catch {
    return Response.json(
      { error: "تعذر إكمال الربط. ابدأ جلسة ربط جديدة من لوحة متجرك." },
      { status: 400 },
    );
  }
}
