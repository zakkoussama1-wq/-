import { Session } from "@shopify/shopify-api";
import { z } from "zod";
import { authenticatedShopTenant } from "@/modules/merchants/local-context";
import { connectionCredential } from "@/modules/integrations/shopify/connections";
import { shopHostname } from "@/modules/integrations/shopify/client";
import {
  integrationsDisabled,
  SHOPIFY_API_VERSION,
} from "@/modules/integrations/shopify/sdk";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const resultSchema = z.object({
  data: z.object({
    currentAppInstallation: z.object({
      accessScopes: z.array(
        z.object({ handle: z.string().regex(/^[a-z][a-z0-9_]*$/) }),
      ),
    }),
  }),
});
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (integrationsDisabled())
    return Response.json(
      { error: "التكاملات الخارجية معطلة." },
      { status: 503, headers },
    );
  let tenant: Awaited<ReturnType<typeof authenticatedShopTenant>>;
  try {
    tenant = await authenticatedShopTenant(request);
  } catch {
    return Response.json(
      { error: "يلزم تسجيل الدخول إلى المتجر الموثّق." },
      { status: 401, headers },
    );
  }
  try {
    // Inspect the current stored token. Do not refresh it, change grants or touch sync jobs.
    const credential = await connectionCredential(
      tenant.merchantId,
      false,
      false,
    );
    const shop = shopHostname(credential.shop);
    if (shop !== tenant.domain) throw new Error("Binding mismatch");
    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": credential.accessToken,
        },
        body: JSON.stringify({
          query:
            "query DzCurrentGrantedScopes { currentAppInstallation { accessScopes { handle } } }",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (
      !response.ok ||
      response.headers.get("x-shopify-api-version") !== "2026-10"
    )
      throw new Error("Scope check unavailable");
    const raw = await response.json();
    if (raw.errors?.length) throw new Error("Scope check rejected");
    const data = resultSchema.parse(raw);
    const grantedScopes = [
      ...new Set(
        data.data.currentAppInstallation.accessScopes.map((s) => s.handle),
      ),
    ].sort();
    const scopes = new Session({
      id: "scope-check",
      shop,
      state: "",
      isOnline: false,
      scope: grantedScopes.join(","),
    });
    return Response.json(
      {
        verified: true,
        source: "currentAppInstallation.accessScopes",
        apiVersion: "2026-10",
        grantedScopes,
        writeOrdersGranted: scopes.isScopeIncluded(["write_orders"]),
        readProductsGranted: scopes.isScopeIncluded(["read_products"]),
        offlineSessionVerified: credential.offline,
        checkedAt: new Date().toISOString(),
      },
      { headers },
    );
  } catch {
    // Never serialize/log exceptions, credentials, Shopify errors or authorization headers.
    return Response.json(
      {
        verified: false,
        code: "SCOPE_CHECK_FAILED",
        error:
          "تعذر التحقق من الصلاحيات الفعلية للتوكن الحالي. لا يمكن استنتاج الصلاحيات من حالة الاتصال وحدها.",
      },
      { status: 502, headers },
    );
  }
}
