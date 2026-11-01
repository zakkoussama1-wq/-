import sharp, { type Metadata } from "sharp";
import { lookup } from "node:dns/promises";
import { mediaStorage } from "./storage";
export const maxImages = 12;
export function maxImageBytes() {
  const value = Number(process.env.MEDIA_MAX_IMAGE_BYTES ?? 5 * 1024 * 1024);
  if (!Number.isSafeInteger(value) || value < 1024 || value > 20 * 1024 * 1024)
    throw new Error("Invalid media size configuration");
  return value;
}
export function remoteHosts() {
  return (
    process.env.MEDIA_REMOTE_HOSTS ?? "images.unsplash.com,images.pexels.com"
  )
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
export async function readLimited(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
) {
  if (!body) throw new RangeError("ملف الصورة فارغ.");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new RangeError("حجم الصورة يتجاوز الحد المسموح.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function storeImage(
  merchant: string,
  input: Buffer,
  mime?: string,
) {
  if (!input.length) throw new RangeError("ملف الصورة فارغ.");
  if (input.length > maxImageBytes())
    throw new RangeError("حجم الصورة يتجاوز الحد المسموح.");
  // Reject SVG/XML and executable containers before invoking any image decoder.
  const png = input
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
  const webp =
    input.subarray(0, 4).toString("ascii") === "RIFF" &&
    input.subarray(8, 12).toString("ascii") === "WEBP";
  if (!png && !jpeg && !webp)
    throw new RangeError("صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WebP.");
  let metadata: Metadata;
  let bytes: Buffer;
  try {
    const image = sharp(input, {
      limitInputPixels: 25000000,
      failOn: "warning",
      animated: false,
    });
    metadata = await image.metadata();
    const formats: Record<string, string> = {
      png: "image/png",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };
    const expected = formats[metadata.format ?? ""];
    if (
      !expected ||
      (mime && mime !== "application/octet-stream" && mime !== expected)
    )
      throw new RangeError(
        "صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WebP.",
      );
    if (
      (metadata.pages ?? 1) > 1 ||
      !metadata.width ||
      !metadata.height ||
      metadata.width < 16 ||
      metadata.height < 16 ||
      metadata.width > 8192 ||
      metadata.height > 8192
    )
      throw new RangeError(
        "أبعاد الصورة يجب أن تكون بين 16 و8192 بكسل، دون صور متحركة.",
      );
    // Decoding and re-encoding validates pixels and removes EXIF and executable tails.
    bytes = await image.rotate().webp({ quality: 88 }).toBuffer();
  } catch (e) {
    if (e instanceof RangeError) throw e;
    throw new RangeError("محتوى الصورة غير صالح أو أبعادها كبيرة جدًا.");
  }
  if (bytes.length > maxImageBytes())
    throw new RangeError("حجم الصورة يتجاوز الحد المسموح.");
  const dimensions = await sharp(bytes).metadata();
  return {
    url: await mediaStorage().put(merchant, bytes, {
      width: dimensions.width!,
      height: dimensions.height!,
    }),
    width: dimensions.width!,
    height: dimensions.height!,
    bytes: bytes.length,
  };
}
function publicIPv4(ip: string) {
  const [a, b, c] = ip.split(".").map(Number);
  return (
    a > 0 &&
    a < 224 &&
    a !== 10 &&
    a !== 127 &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) &&
    !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) &&
    !(a === 203 && b === 0 && c === 113)
  );
}
export async function validateRemoteUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RangeError("أدخل رابط صورة HTTPS صالحًا.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hash ||
    !remoteHosts().includes(url.hostname.toLowerCase())
  )
    throw new RangeError(
      "مصدر الصورة غير مسموح. استخدم الرفع أو نطاقًا معتمدًا.",
    );
  try {
    const addresses = await lookup(url.hostname, { family: 4, all: true });
    if (!addresses.length || addresses.some((a) => !publicIPv4(a.address)))
      throw new Error();
  } catch {
    throw new RangeError("تعذر التحقق من نطاق الصورة العام.");
  }
  return url;
}
/** Imports only operator-approved HTTPS hosts, with every redirect revalidated.
 * fetch preserves the runtime proxy and CA policy; hosts must be trusted public CDNs.
 */
export async function importRemoteImage(merchant: string, raw: string) {
  let next = raw;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const url = await validateRemoteUrl(next);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: { accept: "image/png,image/jpeg,image/webp" },
      });
    } catch {
      throw new RangeError("تعذر تنزيل الصورة. استخدم ملفًا من جهازك.");
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) break;
      next = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new RangeError("تعذر تنزيل الصورة. استخدم ملفًا من جهازك.");
    }
    if (Number(response.headers.get("content-length")) > maxImageBytes()) {
      await response.body?.cancel();
      throw new RangeError("حجم الصورة يتجاوز الحد المسموح.");
    }
    const input = await readLimited(response.body, maxImageBytes());
    return storeImage(
      merchant,
      input,
      response.headers.get("content-type")?.split(";")[0],
    );
  }
  throw new RangeError("تعذر تنزيل الصورة. استخدم ملفًا من جهازك.");
}
