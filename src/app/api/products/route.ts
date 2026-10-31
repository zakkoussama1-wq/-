import { z } from "zod";
import { localMerchantId } from "@/modules/merchants/local-context";
import { getCheckoutCatalog, saveProduct } from "@/modules/checkout/repository";
import { productSchema } from "@/modules/checkout/schema";
import { ConflictError } from "@/modules/shipping/repository";
export async function GET(request: Request) {
  try {
    return Response.json(
      await getCheckoutCatalog(await localMerchantId(request)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "تعذر تحميل المنتجات." }, { status: 503 });
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
    if (Buffer.byteLength(text) > 65536)
      throw new RangeError("بيانات المنتج كبيرة جدًا.");
    const data = z
      .object({
        revision: z.number().int().nonnegative(),
        product: productSchema.strict(),
      })
      .strict()
      .parse(JSON.parse(text));
    return Response.json(
      await saveProduct(
        await localMerchantId(request),
        data.revision,
        data.product,
      ),
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof ConflictError || e instanceof RangeError
            ? e.message
            : "تحقق من بيانات المنتج وأسعاره ومخزونه.",
      },
      {
        status:
          e instanceof ConflictError
            ? 409
            : e instanceof z.ZodError ||
                e instanceof RangeError ||
                e instanceof SyntaxError
              ? 400
              : 503,
      },
    );
  }
}
