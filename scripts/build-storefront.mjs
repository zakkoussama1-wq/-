import { build } from "esbuild";
import { stat } from "node:fs/promises";
for (const [entry, filename] of [
  ["src/storefront/loader.ts", "dz-cod.js"],
  ["src/storefront/entry.tsx", "dz-cod-runtime.js"],
])
  await build({
    entryPoints: [entry],
    outfile: `extensions/dz-cod-form/assets/${filename}`,
    bundle: true,
    minify: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".css": "text" },
    legalComments: "eof",
    sourcemap: false,
  });
if ((await stat("extensions/dz-cod-form/assets/dz-cod.js")).size > 10000)
  throw new Error("Theme App Block loader must stay below 10,000 bytes");
console.log(
  "Storefront validation-only bundle built. No deployment or remote requests performed.",
);
