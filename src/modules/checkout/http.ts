import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { localMerchantId } from "../merchants/local-context";
import { ConflictError } from "../shipping/repository";
import { getCheckoutCatalog, updateDiscount } from "./repository";
import { discountUpdateSchema, pricingInputSchema } from "./schema";
import { CheckoutError, priceCheckout, validateCheckout } from "./service";
function fail(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: "تحقق من حقول الطلب المطلوبة.",
        fields: error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  if (error instanceof CheckoutError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ConflictError)
    return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof RangeError)
    return NextResponse.json({ error: error.message }, { status: 400 });
  console.error("Checkout operation failed");
  return NextResponse.json(
    { error: "تعذر التحقق أو حساب الطلب. أعد المحاولة." },
    { status: 503 },
  );
}
export async function readCatalog(request?: Request) {
  try {
    const catalog = await getCheckoutCatalog(
      await localMerchantId(request, true),
    );
    return NextResponse.json(
      {
        ...catalog,
        products: catalog.products.filter((p) => p.active && !p.deleted),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function checkoutPost(
  request: Request,
  kind: "quote" | "validate" | "discount",
) {
  const url = new URL(request.url);
  if (
    request.headers.get("origin") !==
    `${url.protocol}//${request.headers.get("host") ?? url.host}`
  )
    return NextResponse.json(
      { error: "مصدر الطلب غير مسموح." },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json(
      { error: "صيغة الطلب يجب أن تكون JSON." },
      { status: 415 },
    );
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 8192)
      return NextResponse.json(
        { error: "الطلب يتجاوز الحجم المسموح." },
        { status: 413 },
      );
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "بيانات JSON غير صالحة." },
        { status: 400 },
      );
    }
    const merchant = await localMerchantId(request, kind !== "discount");
    let response: unknown;
    if (kind === "quote")
      response = await priceCheckout(merchant, pricingInputSchema.parse(raw));
    else if (kind === "validate")
      response = await validateCheckout(merchant, raw);
    else {
      const input = discountUpdateSchema.parse(raw);
      response = await updateDiscount(merchant, input.revision, input.discount);
    }
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}
