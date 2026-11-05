import {
  checkOrderSyncReadiness,
  ReadinessAuthError,
} from "@/modules/orders/shopify/readiness";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (
    process.env.DZ_BOOTSTRAP_MODE === "1" ||
    process.env.DZ_LOCAL_DEMO === "1" ||
    process.env.DZ_DISABLE_EXTERNAL_INTEGRATIONS === "1"
  )
    return Response.json(
      { ready: false, code: "INTEGRATIONS_DISABLED" },
      { status: 503, headers },
    );
  try {
    return Response.json(await checkOrderSyncReadiness(request), { headers });
  } catch (error) {
    return Response.json(
      {
        ready: false,
        code:
          error instanceof ReadinessAuthError
            ? error.code
            : "READINESS_STORAGE_UNAVAILABLE",
      },
      {
        status: error instanceof ReadinessAuthError ? error.status : 503,
        headers,
      },
    );
  }
}
