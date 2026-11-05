import { z } from "zod";
import { authenticatedShopTenant } from "@/modules/merchants/local-context";
import { requestOrderSync } from "@/modules/orders/shopify/outbox";
import { orderSyncEnabled } from "@/modules/orders/shopify/types";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!orderSyncEnabled())
    return Response.json(
      { error: "مزامنة الطلبات مع Shopify معطلة." },
      { status: 503, headers },
    );
  const url = new URL(request.url);
  if (
    request.headers.get("origin") !==
    `${url.protocol}//${request.headers.get("host") ?? url.host}`
  )
    return Response.json(
      { error: "مصدر غير مسموح." },
      { status: 403, headers },
    );
  let merchant: string;
  try {
    merchant = (await authenticatedShopTenant(request)).merchantId;
  } catch {
    return Response.json(
      { error: "يلزم تسجيل الدخول إلى المتجر الموثّق." },
      { status: 401, headers },
    );
  }
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 1024)
      return Response.json(
        { error: "حجم الطلب كبير." },
        { status: 413, headers },
      );
    const { id } = z.object({ id: z.uuid() }).strict().parse(JSON.parse(text));
    const sync = await requestOrderSync(merchant, id);
    return Response.json({ sync }, { status: 202, headers });
  } catch (error) {
    const missing =
      error instanceof Error && error.message === "ORDER_NOT_FOUND";
    const invalid = error instanceof z.ZodError || error instanceof SyntaxError;
    return Response.json(
      {
        error: missing
          ? "الطلب غير موجود."
          : invalid
            ? "معرف الطلب غير صالح."
            : "تعذر تجهيز المزامنة. تحقق من حالة الطلب ثم أعد المحاولة.",
      },
      { status: missing ? 404 : invalid ? 400 : 409, headers },
    );
  }
}
