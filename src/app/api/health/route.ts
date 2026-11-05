import { postgresReadiness } from "@/modules/storage/readiness";
import { isLocalDemo } from "@/lib/local-demo";
import { authDb } from "@/modules/auth/store";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (process.env.NODE_ENV === "production") {
      await postgresReadiness();
      return Response.json(
        { ok: true, localDemo: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const db = await authDb();
    try {
      await db.prepare("SELECT 1 AS ok").get();
      return Response.json(
        { ok: true, localDemo: isLocalDemo() },
        { headers: { "Cache-Control": "no-store" } },
      );
    } finally {
      await db.close();
    }
  } catch {
    return Response.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
