import "./production-preflight.mjs";
import { mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute } from "node:path";
if (process.exitCode) process.exit(process.exitCode);
// Docker supplies its own HOSTNAME; Render requires binding to every interface.
process.env.HOSTNAME = "0.0.0.0";
const port = process.env.PORT ?? "3000";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error("PORT must be an integer between 1 and 65535.");
  process.exit(1);
}
process.env.PORT = port;
try {
  if (
    !process.env.MEDIA_STORAGE_PATH ||
    !isAbsolute(process.env.MEDIA_STORAGE_PATH)
  )
    throw new Error();
  await mkdir(process.env.MEDIA_STORAGE_PATH, { recursive: true, mode: 0o700 });
  await access(process.env.MEDIA_STORAGE_PATH, constants.R_OK | constants.W_OK);
} catch {
  console.error(
    "MEDIA_STORAGE_PATH must be an absolute, readable and writable persistent mount path.",
  );
  process.exit(1);
}
await import("../server.js");
