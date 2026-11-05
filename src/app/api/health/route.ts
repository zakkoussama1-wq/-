import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isLocalDemo } from "@/lib/local-demo";
import { authDb } from "@/modules/auth/store";
export const dynamic = "force-dynamic";
let initialized: Promise<void> | undefined;
async function initializeSchema() {
  const db = await authDb();
  try {
    await db.exec("BEGIN");
    await db.lock("bootstrap-schema");
    await db.exec(
      readFileSync(join(process.cwd(), "scripts/postgres-schema.sql"), "utf8"),
    );
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}
export async function GET() {
  try {
    if (process.env.NODE_ENV === "production") {
      initialized ??= initializeSchema().catch((error) => {
        initialized = undefined;
        throw error;
      });
      await initialized;
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
