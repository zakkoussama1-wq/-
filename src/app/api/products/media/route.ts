import { localMerchantId } from "@/modules/merchants/local-context";
import {
  importRemoteImage,
  maxImageBytes,
  maxImages,
  readLimited,
  remoteHosts,
  storeImage,
} from "@/modules/media/service";
export const runtime = "nodejs";
export async function GET() {
  return Response.json(
    { maxBytes: maxImageBytes(), maxImages, remoteHosts: remoteHosts() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production")
    return Response.json(
      { error: "Manual media uploads are disabled in Shopify production mode" },
      { status: 503 },
    );
  const url = new URL(request.url);
  if (
    request.headers.get("origin") !==
    `${url.protocol}//${request.headers.get("host") ?? url.host}`
  )
    return Response.json({ error: "مصدر غير مسموح." }, { status: 403 });
  try {
    const merchant = await localMerchantId(request);
    const type = request.headers.get("content-type") ?? "";
    if (type.startsWith("application/json")) {
      const bytes = await readLimited(request.body, 8192);
      const data = JSON.parse(bytes.toString());
      if (typeof data.url !== "string" || data.url.length > 4096)
        throw new RangeError("أدخل رابط صورة HTTPS صالحًا.");
      return Response.json(await importRemoteImage(merchant, data.url), {
        status: 201,
      });
    }
    if (!type.startsWith("multipart/form-data"))
      return Response.json(
        { error: "صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WebP." },
        { status: 415 },
      );
    const bytes = await readLimited(request.body, maxImageBytes() + 65536);
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": type },
      body: bytes,
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new RangeError("ملف الصورة فارغ.");
    return Response.json(
      await storeImage(
        merchant,
        Buffer.from(await file.arrayBuffer()),
        file.type,
      ),
      { status: 201 },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof RangeError
            ? e.message
            : "تعذر حفظ الصورة. أعد المحاولة.",
      },
      {
        status: e instanceof RangeError || e instanceof SyntaxError ? 400 : 503,
      },
    );
  }
}
