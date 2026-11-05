import { localCommerceAdapter } from "@/modules/commerce/adapter";
import { requestedProduct } from "@/modules/forms/product-form";
import { NextResponse } from "next/server";
import { z } from "zod";
import { localMerchantId } from "@/modules/merchants/local-context";
import {
  exportOrders,
  setOrderStatus,
  statusSchema,
} from "@/modules/orders/repository";
import { CheckoutError } from "@/modules/checkout/service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const orders = await localCommerceAdapter.orders(
      await localMerchantId(request),
    );
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
function orderFailure(error: unknown, stage: string) {
  const headers = { "Cache-Control": "no-store" };
  if (error instanceof z.ZodError) {
    const messages: Record<string, string> = {
      name: "أدخل اسمًا صحيحًا من ثلاثة أحرف على الأقل.",
      phone: "أدخل رقم هاتف جزائري صحيحًا يبدأ بـ 05 أو 06 أو 07.",
      address: "أدخل عنوان منزل واضحًا من ثمانية أحرف على الأقل.",
      wilayaCode: "اختر الولاية الصحيحة.",
      communeId: "اختر البلدية الصحيحة.",
      method: "اختر طريقة توصيل متاحة.",
      productId: "اختر المنتج الصحيح.",
      variantId: "اختر خيار المنتج الصحيح.",
      quantity: "اختر كمية صحيحة بين 1 و10.",
      mode: "اختر النظام الإداري الصحيح.",
      quoteToken: "أعد حساب السعر قبل تأكيد الطلب.",
    };
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = String(issue.path.at(-1) ?? "");
      if (Object.hasOwn(messages, field)) fields[field] = messages[field];
    }
    return NextResponse.json(
      {
        error: Object.values(fields)[0] ?? "تحقق من حقول الطلب المطلوبة.",
        code: "INVALID_ORDER",
        fields,
      },
      { status: 400, headers },
    );
  }
  if (error instanceof SyntaxError)
    return NextResponse.json(
      { error: "صيغة بيانات الطلب غير صالحة.", code: "INVALID_JSON" },
      { status: 400, headers },
    );
  if (error instanceof CheckoutError || error instanceof RangeError)
    return NextResponse.json(
      {
        error: /[\u0600-\u06ff]/.test(error.message)
          ? error.message
          : "تحقق من اختيار المنتج ومنطقة التوصيل.",
        code: "ORDER_REJECTED",
      },
      { status: error instanceof CheckoutError ? error.status : 400, headers },
    );
  const candidate = (error as { code?: unknown } | null)?.code;
  const code =
    typeof candidate === "string" &&
    [
      "23505",
      "23503",
      "42501",
      "42P01",
      "42703",
      "57014",
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
    ].includes(candidate)
      ? candidate
      : "ORDER_SAVE_FAILED";
  console.error(JSON.stringify({ event: "order_save_failed", stage, code }));
  return NextResponse.json(
    {
      error:
        "تعذر حفظ الطلب مؤقتًا. أعد المحاولة بنفس بيانات الطلب؛ لن يُحفظ الطلب مرتين.",
      code: "ORDER_SAVE_UNAVAILABLE",
    },
    { status: 503, headers },
  );
}
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (
    request.headers.get("origin") !==
    `${url.protocol}//${request.headers.get("host") ?? url.host}`
  )
    return NextResponse.json({ error: "مصدر غير مسموح." }, { status: 403 });
  let stage = "parse";
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 8192)
      return NextResponse.json({ error: "حجم الطلب كبير." }, { status: 413 });
    const raw = JSON.parse(text);
    stage = "tenant";
    let merchant: string;
    try {
      merchant = await localMerchantId(request, raw?.action !== "status");
    } catch (error) {
      if (
        error instanceof RangeError ||
        (error instanceof Error &&
          error.message === "Verified Shopify installation required")
      )
        return NextResponse.json(
          {
            error:
              "يلزم تسجيل الدخول إلى متجر Shopify الموثّق ثم إعادة المحاولة.",
            code: "AUTH_REQUIRED",
          },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        );
      throw error;
    }
    stage = "persist";
    if (raw?.action === "status") {
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
    const result = await localCommerceAdapter.submit(
      merchant,
      raw,
      request.headers.get("idempotency-key") ?? "",
      requestedProduct(request),
    );
    return NextResponse.json(
      {
        persisted: true,
        orderId: result.order.id,
        duplicate: result.duplicate,
        message:
          "تم حفظ طلبك بنجاح. الطلب قيد المراجعة وليس عملية شراء مدفوعة.",
      },
      {
        status: result.duplicate ? 200 : 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return orderFailure(error, stage);
  }
}
