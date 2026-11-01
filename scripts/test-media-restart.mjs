// Isolated lifecycle check. Never uses the merchant's databases or media directory.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import sharp from "sharp";
const npmCli = process.env.npm_execpath;
if (!npmCli || !existsSync(npmCli))
  throw new Error("Run with: npm run test:media-restart");
const directory = mkdtempSync(join(tmpdir(), "dz-media-restart-"));
const port = Number(process.env.DZ_MEDIA_TEST_PORT || 3005);
const base = `http://127.0.0.1:${port}`;
let server;
let log = "";
async function start() {
  log = "";
  server = spawn(
    process.execPath,
    [npmCli, "run", "dev:local", "--", "--port", String(port)],
    {
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        DZ_DEMO_DATA_DIR: directory,
        DZ_NEXT_DIST_DIR: ".next-local-tests",
        MEDIA_STORAGE_PATH: join(directory, "media"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const record = (bytes) => {
    log = (log + bytes).slice(-12000);
  };
  server.stdout.on("data", record);
  server.stderr.on("data", record);
  for (let attempt = 0; attempt < 300; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Test server stopped before readiness.");
    try {
      if (
        (
          await fetch(base + "/api/products", {
            signal: AbortSignal.timeout(1000),
          })
        ).ok
      )
        return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Test server readiness timed out.");
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const child = server;
  const stopped = new Promise((resolve) => child.once("exit", resolve));
  if (process.platform === "win32")
    execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  else process.kill(-child.pid, "SIGTERM");
  await Promise.race([
    stopped,
    new Promise((resolve) => {
      const timer = setTimeout(resolve, 5000);
      timer.unref();
    }),
  ]);
  if (child.exitCode === null && process.platform !== "win32")
    process.kill(-child.pid, "SIGKILL");
  server = undefined;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await fetch(base + "/api/health", { signal: AbortSignal.timeout(300) });
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Test server did not release its port.");
}
try {
  let occupied = false;
  try {
    await fetch(base + "/api/health", { signal: AbortSignal.timeout(500) });
    occupied = true;
  } catch {}
  if (occupied)
    throw new Error("Test port is already in use; choose DZ_MEDIA_TEST_PORT.");
  await start();
  const body = new FormData();
  body.set(
    "file",
    new File(
      [
        await sharp({
          create: { width: 48, height: 48, channels: 3, background: "#635bdb" },
        })
          .png()
          .toBuffer(),
      ],
      "../../untrusted-name.exe",
      { type: "image/png" },
    ),
  );
  const upload = await fetch(base + "/api/products/media", {
    method: "POST",
    headers: { origin: base },
    body,
  });
  assert.equal(upload.status, 201);
  const media = await upload.json();
  const catalog = await (await fetch(base + "/api/products")).json();
  const product = {
    ...catalog.products[0],
    id: randomUUID(),
    name: "Restart persistence test",
    sku: "RESTART-SKU",
    images: [media.url],
    imageUrl: media.url,
  };
  const save = await fetch(base + "/api/products", {
    method: "POST",
    headers: { origin: base, "content-type": "application/json" },
    body: JSON.stringify({ revision: catalog.revision, product }),
  });
  assert.equal(save.status, 200);
  const hash = (value) =>
    createHash("sha256").update(Buffer.from(value)).digest("hex");
  const initial = await fetch(base + media.url);
  assert.equal(initial.status, 200);
  const digest = hash(await initial.arrayBuffer());
  await stop();
  await start();
  const reloaded = await (await fetch(base + "/api/products")).json();
  const persisted = reloaded.products.find((item) => item.id === product.id);
  assert.equal(persisted.sku, product.sku);
  assert.equal(persisted.imageUrl, media.url);
  const image = await fetch(base + media.url);
  assert.equal(image.status, 200);
  assert.equal(hash(await image.arrayBuffer()), digest);
  console.log(
    "PASS: product metadata and identical image bytes persisted across a full local server restart. No merchant data was used.",
  );
} catch (error) {
  console.error(error.message);
  console.error(log);
  process.exitCode = 1;
} finally {
  await stop();
  rmSync(directory, { recursive: true, force: true });
}
