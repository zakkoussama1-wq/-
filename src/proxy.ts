import { NextResponse, type NextRequest } from "next/server";
import { validSession } from "@/modules/auth/store";
import { localMerchantId } from "@/modules/merchants/local-context";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (process.env.NODE_ENV === "production") {
    const bootstrap = [
      "/api/auth",
      "/api/health",
      "/api/shopify/webhooks",
      "/api/integrations/shopify/callback",
      "/api/integrations/shopify/start",
      "/api/integrations/shopify",
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
          { error: "Authenticated Shopify tenant required" },
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
    ? NextResponse.json({ error: "يلزم تسجيل الدخول." }, { status: 401 })
    : NextResponse.redirect(new URL("/login", request.url));
}
export const config = {
  matcher: [
    "/",
    "/dashboard",
    "/api/shipping/:path*",
    "/api/checkout/discount",
    "/api/orders",
    "/api/form-config",
    "/api/products/:path*",
    "/api/advertising/:path*",
    "/api/integrations/:path*",
    "/api/checkout/:path*",
    "/api/simulation/:path*",
  ],
};
