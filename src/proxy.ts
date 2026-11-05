import { NextResponse, type NextRequest } from "next/server";
import { validSession } from "@/modules/auth/store";
import { localMerchantId } from "@/modules/merchants/local-context";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (process.env.DZ_BOOTSTRAP_MODE === "1") {
    if (path !== "/api/health")
      return NextResponse.json(
        {
          error: "Deployment setup required; Shopify is unavailable",
          code: "SETUP_REQUIRED",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.next();
  }
  // This handler authenticates the same hashed merchant session in a PostgreSQL
  // READ ONLY transaction. Avoid schema-initializing auth helpers on this probe.
  if (
    [
      "/api/orders/shopify-sync/readiness",
      "/api/orders/shopify-sync/diagnostics",
    ].includes(path)
  )
    return NextResponse.next();
  if (process.env.NODE_ENV === "production") {
    const bootstrap = [
      "/api/auth",
      "/api/health",
      "/api/shopify/webhooks",
      "/api/integrations/shopify/callback",
      "/api/integrations/shopify/start",
      "/api/integrations/shopify",
      // Session protection below still applies; the handler performs tenant authorization
      // and returns distinct session/connection failures instead of generic AUTH_REQUIRED.
      "/api/integrations/shopify/scopes",
    ];
    if (
      path.startsWith("/api/") &&
      !path.startsWith("/api/geography/") &&
      !bootstrap.includes(path)
    ) {
      try {
        await localMerchantId(request);
      } catch {
        return NextResponse.json(
          {
            error: "يلزم تسجيل الدخول إلى متجر Shopify الموثّق.",
            code: "AUTH_REQUIRED",
          },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    if (path.startsWith("/api/simulation/") || path === "/api/advertising")
      return NextResponse.json(
        { error: "Production advertising is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
  }
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DZ_AUTH_TEST_BYPASS === "1"
  )
    return NextResponse.next();
  const p = request.nextUrl.pathname;
  const admin =
    p.startsWith("/api/products") ||
    p.startsWith("/api/advertising") ||
    (p.startsWith("/api/integrations/") && !p.endsWith("/callback")) ||
    (p === "/api/form-config" && request.method !== "GET") ||
    p === "/" ||
    p === "/dashboard" ||
    p === "/api/shipping" ||
    p === "/api/shipping/csv" ||
    p === "/api/checkout/discount" ||
    (p === "/api/orders" && request.method === "GET");
  const status = p === "/api/orders" && request.method === "PATCH";
  if (!(admin || status)) return NextResponse.next();
  if (await validSession(request.cookies.get("dz_session")?.value ?? ""))
    return NextResponse.next();
  return p.startsWith("/api/")
    ? NextResponse.json(
        { error: "يلزم تسجيل الدخول.", code: "AUTH_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      )
    : NextResponse.redirect(new URL("/login", request.url));
}
export const config = {
  matcher: [
    "/api/health",
    "/api/auth",
    "/api/shopify/webhooks",
    "/media/:path*",
    "/form",
    "/",
    "/dashboard",
    "/api/shipping/:path*",
    "/api/checkout/discount",
    "/api/orders/:path*",
    "/api/form-config",
    "/api/products/:path*",
    "/api/advertising/:path*",
    "/api/integrations/:path*",
    "/api/checkout/:path*",
    "/api/simulation/:path*",
  ],
};
