import { mediaStorage, mediaFilename } from "@/modules/media/storage";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await context.params;
    if (!mediaFilename.test(filename))
      return new Response(null, { status: 404 });
    const { bytes } = await mediaStorage().get(filename);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Disposition": 'inline; filename="product.webp"',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
