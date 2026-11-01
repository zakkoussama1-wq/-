import { z } from "zod";
import { localMerchantId } from "@/modules/merchants/local-context";
import { getCheckoutCatalog } from "@/modules/checkout/repository";
import { eventTypeSchema, settingsSchema } from "@/modules/advertising/schema";
import {
  readSimulation,
  updateSimulationSettings,
  retrySimulation,
  withSimulation,
  recordSimulation,
  simulationEventId,
  simulationSettings,
} from "@/modules/advertising/simulation";
import { ConflictError } from "@/modules/shipping/repository";
export async function GET(request: Request) {
  try {
    return Response.json(await readSimulation(await localMerchantId(request)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "تعذر تحميل سجل المحاكاة." },
      { status: 503 },
    );
  }
}
const actions = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("settings"), settings: settingsSchema })
    .strict(),
  z
    .object({
      action: z.literal("retry"),
      eventId: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  z
    .object({
      action: z.literal("simulate"),
      runId: z.uuid(),
      eventType: eventTypeSchema,
      fail: z.boolean(),
    })
    .strict(),
]);
export async function POST(request: Request) {
  const u = new URL(request.url);
  if (
    request.headers.get("origin") !==
    `${u.protocol}//${request.headers.get("host") ?? u.host}`
  )
    return Response.json({ error: "مصدر غير مسموح." }, { status: 403 });
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 4096)
      return Response.json({ error: "حجم الطلب كبير." }, { status: 413 });
    const input = actions.parse(JSON.parse(text));
    const merchant = await localMerchantId(request);
    if (input.action === "settings")
      await updateSimulationSettings(merchant, input.settings);
    if (input.action === "retry")
      await retrySimulation(merchant, input.eventId);
    if (input.action === "simulate") {
      const product = (await getCheckoutCatalog(merchant)).products.find(
        (p) => p.active && !p.deleted,
      );
      if (!product) throw new RangeError("أضف منتجًا نشطًا لاختبار المحاكاة.");
      const variant = product.variants[0];
      await withSimulation(merchant, async (db) => {
        if (!(await simulationSettings(db, merchant)).enabled)
          throw new RangeError("فعّل المحاكاة المحلية أولًا.");
        await recordSimulation(db, merchant, {
          eventId: simulationEventId(merchant, input.runId, input.eventType),
          eventType: input.eventType,
          source: "admin",
          productId: product.id,
          sku: variant.sku || product.sku,
          variantId: variant.id,
          quantity: 1,
          valueMinor: variant.priceMinor,
          fail: input.fail,
        });
      });
    }
    return Response.json(await readSimulation(merchant), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof RangeError || e instanceof ConflictError
            ? e.message
            : "تعذر تنفيذ اختبار المحاكاة.",
      },
      { status: e instanceof ConflictError ? 409 : 400 },
    );
  }
}
