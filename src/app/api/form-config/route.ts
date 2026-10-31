import { listCommunes } from "@/modules/geography/repository";
import { getCheckoutCatalog } from "@/modules/checkout/repository";
import { getFormSettings } from "@/modules/forms/repository";
import { authDb } from "@/modules/auth/store";
import { localMerchantId } from "@/modules/merchants/local-context";
import { formSettingsSchema } from "@/modules/forms/settings";
async function dbOpen() {
  const db = await authDb();
  await db.exec(
    "CREATE TABLE IF NOT EXISTS form_settings(merchant_id TEXT PRIMARY KEY,settings TEXT NOT NULL)",
  );
  return db;
}
export async function GET(request: Request) {
  return Response.json(
    await getFormSettings(await localMerchantId(request, true)),
    { headers: { "Cache-Control": "no-store" } },
  );
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
    const merchant = await localMerchantId(request);
    if (
      !settings.elements.geography &&
      !listCommunes(settings.administrativeMode, settings.fixedWilaya).some(
        (c) => c.id === settings.fixedCommune,
      )
    )
      throw new Error();
    if (settings.featuredProductId || settings.featuredVariantId) {
      const catalog = await getCheckoutCatalog(merchant);
      const product = settings.featuredProductId
        ? catalog.products.find(
            (p) => p.id === settings.featuredProductId && p.active,
          )
        : catalog.products.find((p) => p.active);
      if (
        !product ||
        (settings.featuredVariantId &&
          !product.variants.some((v) => v.id === settings.featuredVariantId))
      )
        throw new Error();
    }
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
