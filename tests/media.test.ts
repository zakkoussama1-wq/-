import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { lookup } from "node:dns/promises";
import {
  importRemoteImage,
  maxImageBytes,
  readLimited,
  storeImage,
  validateRemoteUrl,
} from "../src/modules/media/service";
import {
  assertOwnedMedia,
  LocalMediaStorage,
  mediaRoot,
} from "../src/modules/media/storage";
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
const dir = mkdtempSync(join(tmpdir(), "dz-media-unit-"));
const merchant = "tenant-a";
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv("MEDIA_STORAGE_PATH", dir);
  vi.mocked(lookup).mockResolvedValue([
    { address: "93.184.216.34", family: 4 },
  ] as never);
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});
async function image(format: "png" | "jpeg" | "webp" = "png", width = 64) {
  return sharp({
    create: { width, height: 48, channels: 3, background: "#635bdb" },
  })
    [format]()
    .toBuffer();
}
describe("persistent validated product media", () => {
  it.each(["png", "jpeg", "webp"] as const)(
    "decodes %s, stores immutable WebP and survives a new adapter instance",
    async (format) => {
      const value = await storeImage(
        merchant,
        await image(format),
        `image/${format}`,
      );
      expect(value.url).toMatch(/^\/media\/[a-f0-9]{64}\.webp$/);
      const saved = await new LocalMediaStorage(dir).get(value.url.slice(7));
      expect(saved.metadata).toMatchObject({ merchant, width: 64, height: 48 });
      expect((await sharp(saved.bytes).metadata()).format).toBe("webp");
      await expect(assertOwnedMedia("tenant-b", [value.url])).rejects.toThrow(
        "لا تنتمي",
      );
      await expect(
        assertOwnedMedia(merchant, [value.url]),
      ).resolves.toBeUndefined();
    },
  );
  it("strips appended content and metadata rather than storing original bytes", async () => {
    const input = await sharp(await image())
      .withExif({ IFD0: { ImageDescription: "private test metadata" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const value = await storeImage(
      merchant,
      Buffer.concat([input, Buffer.from("<script>secret</script>")]),
      "image/jpeg",
    );
    const saved = await new LocalMediaStorage(dir).get(value.url.slice(7));
    expect(saved.bytes.includes(Buffer.from("<script>"))).toBe(false);
    expect((await sharp(saved.bytes).metadata()).exif).toBeUndefined();
  });
  it("rejects SVG, executable content, forged MIME types, truncated files and small dimensions", async () => {
    for (const data of [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      Buffer.from("MZ executable"),
      (await image()).subarray(0, 30),
    ])
      await expect(storeImage(merchant, data, "image/png")).rejects.toThrow();
    await expect(
      storeImage(merchant, await image("jpeg"), "image/png"),
    ).rejects.toThrow("صيغة");
    await expect(
      storeImage(merchant, await image("png", 8), "image/png"),
    ).rejects.toThrow("أبعاد");
  });
  it("enforces configurable input limits, streamed limits and safe paths", async () => {
    vi.stubEnv("MEDIA_MAX_IMAGE_BYTES", "1024");
    expect(maxImageBytes()).toBe(1024);
    await expect(storeImage(merchant, Buffer.alloc(1025))).rejects.toThrow(
      "حجم",
    );
    await expect(
      readLimited(new Response(Buffer.alloc(1025)).body, 1024),
    ).rejects.toThrow("حجم");
    await expect(
      new LocalMediaStorage(dir).get("../outside.webp"),
    ).rejects.toThrow();
    await expect(
      new LocalMediaStorage(dir).get("a".repeat(64) + ".webp.json"),
    ).rejects.toThrow();
  });
  it("defaults storage to the catalog directory, keeping local demo backups complete", () => {
    vi.stubEnv("MEDIA_STORAGE_PATH", "");
    vi.stubEnv("CHECKOUT_DATABASE_PATH", join(dir, "catalog.sqlite"));
    expect(mediaRoot()).toBe(join(dir, "media"));
  });
});
describe("bounded remote HTTPS import", () => {
  it("rejects unapproved hosts, credentials, insecure URLs, ports and private DNS results before fetch", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const url of [
      "http://images.unsplash.com/a",
      "https://localhost/a",
      "https://evil.test/a",
      "https://x:y@images.unsplash.com/a",
      "https://images.unsplash.com:444/a",
    ])
      await expect(importRemoteImage(merchant, url)).rejects.toThrow();
    for (const ip of [
      "127.0.0.1",
      "10.0.0.2",
      "169.254.169.254",
      "172.16.0.1",
      "192.168.0.1",
      "100.64.0.1",
    ]) {
      vi.mocked(lookup).mockResolvedValue([
        { address: ip, family: 4 },
      ] as never);
      await expect(
        validateRemoteUrl("https://images.unsplash.com/a"),
      ).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("imports a valid response locally and does not retain a signed source URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(await image(), {
        headers: { "content-type": "image/png" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const result = await importRemoteImage(
      merchant,
      "https://images.unsplash.com/photo?signature=private-test",
    );
    expect(result.url).toMatch(/^\/media\//);
    expect(JSON.stringify(result)).not.toContain("signature");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      redirect: "manual",
      headers: { accept: "image/png,image/jpeg,image/webp" },
    });
  });
  it("revalidates redirects and rejects HTML, upstream failures and oversized responses", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/private" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      importRemoteImage(merchant, "https://images.unsplash.com/a"),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    for (const response of [
      new Response("<html>page</html>", {
        headers: { "content-type": "text/html" },
      }),
      new Response(null, { status: 403 }),
      new Response(null, { headers: { "content-length": "999999999" } }),
    ]) {
      fetcher.mockResolvedValue(response);
      await expect(
        importRemoteImage(merchant, "https://images.unsplash.com/a"),
      ).rejects.toThrow();
    }
  });
});
