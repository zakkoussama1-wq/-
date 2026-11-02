import { mediaStorage, mediaFilename } from "@/modules/media/storage";
import { localMerchantId } from "@/modules/merchants/local-context";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await context.params;
    if (!mediaFilename.test(filename))
      return new Response(null, { status: 404 });
    const tenant =
      process.env.NODE_ENV === "production"
        ? await localMerchantId(_request)
        : undefined;
    const { bytes, metadata } = await mediaStorage().get(filename, tenant);
    if (
      process.env.NODE_ENV === "production" &&
      metadata.merchant !== (await localMerchantId(_request))
    )
      return new Response(null, { status: 404 });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control":
          process.env.NODE_ENV === "production"
            ? "private, no-store"
            : "public, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Disposition": 'inline; filename="product.webp"',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
