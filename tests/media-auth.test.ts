import { afterAll, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { proxy } from "../src/proxy";
const directory = mkdtempSync(join(tmpdir(), "dz-media-auth-"));
afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});
it.each(["GET", "POST"])(
  "requires authentication for media %s in production",
  async (method) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DZ_LOCAL_DEMO", "1");
    vi.stubEnv("AUTH_DATABASE_PATH", join(directory, "auth.sqlite"));
    const result = await proxy(
      new NextRequest("http://localhost/api/products/media", { method }),
    );
    expect(result.status).toBe(401);
  },
);
