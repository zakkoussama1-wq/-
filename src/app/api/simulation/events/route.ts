import { z } from "zod";
import { localMerchantId } from "@/modules/merchants/local-context";
import { getCheckoutCatalog } from "@/modules/checkout/repository";
import {
  recordSimulation,
  simulationEventId,
  simulationSettings,
  withSimulation,
} from "@/modules/advertising/simulation";
const inputSchema = z
  .object({
    consent: z.literal(true),
    visitId: z.uuid(),
    eventType: z.enum(["page_view", "product_view", "checkout_started"]),
    productId: z.string().min(1).max(100),
    variantId: z.string().max(100).optional(),
    quantity: z.number().int().min(1).max(10),
  })
  .strict();
export async function POST(request: Request) {
  const u = new URL(request.url);
  if (
    request.headers.get("origin") !==
    `${u.protocol}//${request.headers.get("host") ?? u.host}`
  )
    return Response.json({ error: "مصدر غير مسموح." }, { status: 403 });
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 2048)
      return Response.json({ error: "حجم الطلب كبير." }, { status: 413 });
    const data = inputSchema.parse(JSON.parse(text));
    const merchant = await localMerchantId(request, true);
    const product = (await getCheckoutCatalog(merchant)).products.find(
      (p) => p.id === data.productId && p.active && !p.deleted,
    );
    const variant =
      product?.variants.find((v) => v.id === data.variantId) ??
      product?.variants[0];
    if (!product || !variant)
      return Response.json(
        { error: "المنتج أو الخيار المحدد غير متاح." },
        { status: 404 },
      );
    await withSimulation(merchant, async (db) => {
      if (!(await simulationSettings(db, merchant)).enabled) return;
      const bucket = Math.floor(Date.now() / 60000);
      const row = await db
        .prepare(
          "SELECT count FROM simulation_limits WHERE merchant_id=? AND bucket=?",
        )
        .get(merchant, bucket);
      if (Number(row?.count ?? 0) >= 120)
        throw new RangeError(
          "تم تجاوز حد أحداث المحاكاة. أعد المحاولة لاحقًا.",
        );
      await db
        .prepare("DELETE FROM simulation_limits WHERE bucket<?")
        .run(bucket - 2);
      await db
        .prepare(
          "INSERT INTO simulation_limits VALUES(?,?,1) ON CONFLICT(merchant_id,bucket) DO UPDATE SET count=simulation_limits.count+1",
        )
        .run(merchant, bucket);
      await recordSimulation(db, merchant, {
        eventId: simulationEventId(
          merchant,
          `${data.visitId}:${product.id}`,
          data.eventType,
        ),
        eventType: data.eventType,
        source: "browser",
        productId: product.id,
        sku: variant.sku || product.sku,
        variantId: variant.id,
        quantity: data.quantity,
        valueMinor: variant.priceMinor * data.quantity,
      });
    });
    return Response.json({ simulated: true, providerConfirmed: false });
  } catch {
    return Response.json(
      { error: "تعذر تسجيل حدث المحاكاة." },
      { status: 400 },
    );
  }
}
