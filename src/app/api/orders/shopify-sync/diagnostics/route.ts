import {
  orderTrialDiagnostics,
  DiagnosticAccessError,
} from "@/modules/orders/shopify/diagnostics";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (
    process.env.DZ_BOOTSTRAP_MODE === "1" ||
    process.env.DZ_LOCAL_DEMO === "1"
  )
    return Response.json(
      { code: "INTEGRATIONS_DISABLED" },
      { status: 503, headers },
    );
  try {
    return Response.json(await orderTrialDiagnostics(request), { headers });
  } catch (error) {
    return Response.json(
      {
        code:
          error instanceof DiagnosticAccessError
            ? error.code
            : "DIAGNOSTIC_STORAGE_UNAVAILABLE",
      },
      {
        status: error instanceof DiagnosticAccessError ? error.status : 503,
        headers,
      },
    );
  }
}
