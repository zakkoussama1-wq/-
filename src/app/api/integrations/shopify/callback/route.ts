import {
  verifyOAuthQuery,
  shopHostname,
} from "@/modules/integrations/shopify/client";
import {
  consumeOAuthState,
  saveConnection,
} from "@/modules/integrations/shopify/connections";
import {
  externalShopifyRequest,
  integrationsDisabled,
  shopifyConfiguration,
  shopifySdk,
  SHOPIFY_SCOPES,
} from "@/modules/integrations/shopify/sdk";
import {
  registerUninstallWebhook,
  verifyShopSession,
} from "@/modules/integrations/shopify/lifecycle";
export async function GET(request: Request) {
  if (integrationsDisabled())
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
    const { origin } = shopifyConfiguration();
    const timestamp = Number(p.get("timestamp"));
    if (
      !p.get("timestamp") ||
      !Number.isFinite(timestamp) ||
      Math.abs(Date.now() / 1000 - timestamp) > 300 ||
      !verifyOAuthQuery(p, secret)
    )
      return Response.json(
        { error: "تعذر التحقق من توقيع Shopify أو انتهت صلاحية الطلب." },
        { status: 400 },
      );
    const shop = shopHostname(p.get("shop") ?? "");
    if (
      process.env.SHOPIFY_SHOP &&
      shop !== shopHostname(process.env.SHOPIFY_SHOP)
    )
      throw new Error("Shop not authorized");
    const merchant = await consumeOAuthState(p.get("state") ?? "", shop);
    const { session, headers } = await shopifySdk().auth.callback<Headers>({
      rawRequest: externalShopifyRequest(request),
      expiring: true,
    });
    if (
      !session.accessToken ||
      session.shop !== shop ||
      session.isOnline ||
      !session.isScopeIncluded(SHOPIFY_SCOPES) ||
      !session.expires ||
      !session.refreshToken ||
      !session.refreshTokenExpires
    )
      throw new Error("Invalid offline authorization");
    await verifyShopSession(session);
    await registerUninstallWebhook(session);
    await saveConnection(
      merchant,
      shop,
      session.accessToken,
      session.scope ?? "",
      session,
    );
    headers.set("Location", new URL("/dashboard", origin).href);
    headers.set("Cache-Control", "no-store");
    return new Response(null, { status: 303, headers });
  } catch {
    return Response.json(
      { error: "تعذر إكمال الربط. ابدأ جلسة ربط جديدة من لوحة متجرك." },
      { status: 400 },
    );
  }
}
