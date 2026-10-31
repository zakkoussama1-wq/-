import { authDb } from "@/modules/auth/store";
import { localMerchantId } from "@/modules/merchants/local-context";
import {
  formSettingsSchema,
  defaultFormSettings,
} from "@/modules/forms/settings";
async function dbOpen() {
  const db = await authDb();
  await db.exec(
    "CREATE TABLE IF NOT EXISTS form_settings(merchant_id TEXT PRIMARY KEY,settings TEXT NOT NULL)",
  );
  return db;
}
export async function GET(request: Request) {
  const db = await dbOpen();
  try {
    const row = await db
      .prepare("SELECT settings FROM form_settings WHERE merchant_id=?")
      .get(await localMerchantId(request, true));
    return Response.json(
      row
        ? formSettingsSchema.parse(JSON.parse(String(row.settings)))
        : defaultFormSettings,
      { headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    await db.close();
  }
}
export async function POST(request: Request) {
  const u = new URL(request.url);
  if (
    request.headers.get("origin") !==
    `${u.protocol}//${request.headers.get("host") ?? u.host}`
  )
    return Response.json({ error: "مصدر غير مسموح." }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 8192) throw new Error();
    const settings = formSettingsSchema.parse(JSON.parse(text));
    const db = await dbOpen();
    try {
      await db
        .prepare(
          "INSERT INTO form_settings VALUES(?,?) ON CONFLICT(merchant_id) DO UPDATE SET settings=excluded.settings",
        )
        .run(await localMerchantId(request), JSON.stringify(settings));
    } finally {
      await db.close();
    }
    return Response.json({ saved: true });
  } catch {
    return Response.json(
      { error: "تحقق من إعدادات النموذج." },
      { status: 400 },
    );
  }
}
