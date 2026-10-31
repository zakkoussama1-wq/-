import { NextResponse } from "next/server";
import { z } from "zod";
import { localMerchantId } from "@/modules/merchants/local-context";
import {
  createOrder,
  exportOrders,
  listOrders,
  setOrderStatus,
  statusSchema,
} from "@/modules/orders/repository";
import { CheckoutError } from "@/modules/checkout/service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const orders = await listOrders(await localMerchantId(request));
    return new URL(request.url).searchParams.get("format") === "csv"
      ? new Response(exportOrders(orders), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="orders.csv"',
            "Cache-Control": "no-store",
          },
        })
      : NextResponse.json(
          { orders },
          { headers: { "Cache-Control": "no-store" } },
        );
  } catch {
    return NextResponse.json({ error: "تعذر تحميل الطلبات." }, { status: 503 });
  }
}
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (
    request.headers.get("origin") !==
    `${url.protocol}//${request.headers.get("host") ?? url.host}`
  )
    return NextResponse.json({ error: "مصدر غير مسموح." }, { status: 403 });
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 8192)
      return NextResponse.json({ error: "حجم الطلب كبير." }, { status: 413 });
    const raw = JSON.parse(text);
    const merchant = await localMerchantId(request, raw.action !== "status");
    if (raw.action === "status") {
      const { validSession } = await import("@/modules/auth/store");
      const token =
        request.headers
          .get("cookie")
          ?.match(/(?:^|; )dz_session=([a-f0-9]+)/)?.[1] ?? "";
      if (
        !(
          process.env.NODE_ENV !== "production" &&
          process.env.DZ_AUTH_TEST_BYPASS === "1"
        ) &&
        !(await validSession(token))
      )
        return NextResponse.json(
          { error: "يلزم تسجيل الدخول." },
          { status: 401 },
        );
      const data = z
        .object({
          action: z.literal("status"),
          id: z.uuid(),
          status: statusSchema,
        })
        .strict()
        .parse(raw);
      await setOrderStatus(merchant, data.id, data.status);
      return NextResponse.json({ saved: true });
    }
    const result = await createOrder(
      merchant,
      raw,
      request.headers.get("idempotency-key") ?? "",
    );
    return NextResponse.json(
      {
        persisted: true,
        orderId: result.order.id,
        duplicate: result.duplicate,
        message:
          "تم حفظ طلبك بنجاح. الطلب قيد المراجعة وليس عملية شراء مدفوعة.",
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof CheckoutError
            ? e.message
            : "تحقق من بيانات الطلب أو حاول مجددًا.",
      },
      {
        status:
          e instanceof CheckoutError
            ? e.status
            : e instanceof z.ZodError || e instanceof SyntaxError
              ? 400
              : 503,
      },
    );
  }
}
