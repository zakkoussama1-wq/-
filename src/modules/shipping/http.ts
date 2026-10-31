import { NextResponse } from "next/server";
import { administrativeModeSchema } from "../geography/schema";
import { mutationSchema, quoteSchema } from "./schema";
import { changeShipping, ConflictError, getShippingState } from "./repository";
import { quoteShipping } from "./service";
import { exportShippingCsv, importShippingCsv } from "./csv";
import { localMerchantId as merchant } from "../merchants/local-context";
function fail(error: unknown) {
  if (error instanceof ConflictError)
    return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof RangeError)
    return NextResponse.json({ error: error.message }, { status: 400 });
  console.error("Shipping operation failed");
  return NextResponse.json(
    { error: "تعذر إتمام عملية الشحن. أعد المحاولة." },
    { status: 503 },
  );
}
function mode(request: Request) {
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((k) => k !== "mode"))
    throw new RangeError("معايير الطلب غير صالحة.");
  const result = administrativeModeSchema.safeParse(
    url.searchParams.get("mode") ?? "legacy58",
  );
  if (!result.success) throw new RangeError("نظام إداري غير صالح.");
  return result.data;
}
export async function readShipping(request: Request, csv = false) {
  try {
    const state = await getShippingState(
      await merchant(request),
      mode(request),
    );
    return csv
      ? new Response(exportShippingCsv(state.entries), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="shipping.csv"',
            "Cache-Control": "no-store",
          },
        })
      : NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}
export async function writeShipping(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const expectedOrigin = `${requestUrl.protocol}//${request.headers.get("host") ?? requestUrl.host}`;
  if (origin !== expectedOrigin)
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
    if (text.length > 1100000)
      return NextResponse.json(
        { error: "الملف يتجاوز الحجم المسموح." },
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
    const parsed = mutationSchema.safeParse(raw);
    if (!parsed.success)
      return NextResponse.json(
        {
          error:
            "تحقق من الأسعار والمعرفات؛ يجب ضبط سعر غير سالب لكل طريقة مفعّلة.",
          details: parsed.error.issues.map((i) => i.message),
        },
        { status: 400 },
      );
    const data = parsed.data;
    let change: Parameters<typeof changeShipping>[3];
    if (data.action === "import") {
      try {
        change = { entries: importShippingCsv(data.csv) };
      } catch (error) {
        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : "ملف CSV غير صالح.",
          },
          { status: 400 },
        );
      }
    } else if (data.action === "save") change = { entries: data.entries };
    else if (data.action === "reset") change = { reset: data.targets };
    else change = { genericOffice: data.genericOffice };
    return NextResponse.json(
      await changeShipping(
        await merchant(request),
        data.mode,
        data.revision,
        change,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function readQuote(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const result = quoteSchema.safeParse(params);
    if (!result.success)
      return NextResponse.json(
        { error: "معايير حساب الشحن غير صالحة." },
        { status: 400 },
      );
    return NextResponse.json(
      await quoteShipping(await merchant(request), result.data),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return fail(error);
  }
}
