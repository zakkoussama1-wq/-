import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";

export const mediaFilename = /^[a-f0-9]{64}\.webp$/;
export type MediaRecord = {
  merchant: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
};
/** Immutable objects: removing a product reference never removes historical media. */
export interface MediaStorage {
  put(
    merchant: string,
    bytes: Buffer,
    dimensions: { width: number; height: number },
  ): Promise<string>;
  get(filename: string): Promise<{ bytes: Buffer; metadata: MediaRecord }>;
}
export function mediaRoot() {
  if (process.env.MEDIA_STORAGE_PATH)
    return resolve(/* turbopackIgnore: true */ process.env.MEDIA_STORAGE_PATH);
  if (process.env.CHECKOUT_DATABASE_PATH)
    return join(
      dirname(
        resolve(/* turbopackIgnore: true */ process.env.CHECKOUT_DATABASE_PATH),
      ),
      "media",
    );
  return join(process.cwd(), "data", "media");
}
export class LocalMediaStorage implements MediaStorage {
  constructor(private root = mediaRoot()) {}
  async put(
    merchant: string,
    bytes: Buffer,
    dimensions: { width: number; height: number },
  ) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const filename = randomBytes(32).toString("hex") + ".webp";
    await writeFile(join(this.root, filename), bytes, {
      flag: "wx",
      mode: 0o600,
    });
    await writeFile(
      join(this.root, filename + ".json"),
      JSON.stringify({
        merchant,
        ...dimensions,
        bytes: bytes.length,
        createdAt: new Date().toISOString(),
      } satisfies MediaRecord),
      { flag: "wx", mode: 0o600 },
    );
    return "/media/" + filename;
  }
  async get(filename: string) {
    if (!mediaFilename.test(filename))
      throw new RangeError("الصورة غير موجودة.");
    const metadata: MediaRecord = JSON.parse(
      await readFile(join(this.root, filename + ".json"), "utf8"),
    );
    const bytes = await readFile(join(this.root, filename));
    return { bytes, metadata };
  }
}
export function mediaStorage(): MediaStorage {
  const driver = process.env.MEDIA_STORAGE_DRIVER || "local";
  if (driver !== "local")
    throw new Error("Media storage adapter is not configured");
  return new LocalMediaStorage();
}
export async function assertOwnedMedia(
  merchant: string,
  references: (string | undefined)[],
) {
  for (const reference of new Set(references.filter((s): s is string => !!s))) {
    if (!reference.startsWith("/media/")) continue;
    try {
      const { metadata } = await mediaStorage().get(reference.slice(7));
      if (metadata.merchant !== merchant) throw new Error();
    } catch {
      throw new RangeError("الصورة غير موجودة أو لا تنتمي إلى متجرك.");
    }
  }
}
