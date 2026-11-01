import { expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
it("removes only generated runtime data and Proxy trace entries while preserving source data and geography", () => {
  const dir = mkdtempSync(join(tmpdir(), "dz-build-data-"));
  try {
    for (const path of [
      "data/media",
      ".next/server",
      ".next/standalone/data/media",
    ])
      mkdirSync(join(dir, path), { recursive: true });
    writeFileSync(join(dir, "data/auth.sqlite"), "source-private-data");
    writeFileSync(join(dir, "data/media/photo.webp"), "source-photo");
    writeFileSync(
      join(dir, ".next/standalone/server.js"),
      "// generated server",
    );
    writeFileSync(
      join(dir, ".next/standalone/data/auth.sqlite"),
      "generated-copy",
    );
    writeFileSync(
      join(dir, ".next/standalone/data/geography.sqlite"),
      "public-geography",
    );
    writeFileSync(
      join(dir, ".next/standalone/data/media/photo.webp"),
      "generated-photo",
    );
    writeFileSync(
      join(dir, ".next/server/middleware.js.nft.json"),
      JSON.stringify({
        version: 1,
        files: ["../../data/auth.sqlite", "../../data/geography.sqlite"],
        fileHashes: { "../../data/auth.sqlite": "hash" },
      }),
    );
    execFileSync(process.execPath, [resolve("scripts/check-build-data.mjs")], {
      cwd: dir,
      env: {
        ...process.env,
        DZ_NEXT_DIST_DIR: ".next",
        MEDIA_STORAGE_PATH: "",
      },
      stdio: "pipe",
    });
    expect(readFileSync(join(dir, "data/auth.sqlite"), "utf8")).toBe(
      "source-private-data",
    );
    expect(readFileSync(join(dir, "data/media/photo.webp"), "utf8")).toBe(
      "source-photo",
    );
    expect(existsSync(join(dir, ".next/standalone/data/auth.sqlite"))).toBe(
      false,
    );
    expect(existsSync(join(dir, ".next/standalone/data/media"))).toBe(false);
    expect(
      existsSync(join(dir, ".next/standalone/data/geography.sqlite")),
    ).toBe(true);
    const trace = JSON.parse(
      readFileSync(join(dir, ".next/server/middleware.js.nft.json"), "utf8"),
    );
    expect(trace.files).toEqual(["../../data/geography.sqlite"]);
    expect(trace.fileHashes).toEqual({});
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
