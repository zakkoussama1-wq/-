// Next's Proxy trace can retain runtime SQLite files even when route exclusions apply.
// Remove ONLY generated build copies and their trace entries, never source data.
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
const root = process.cwd();
const dist = resolve(process.env.DZ_NEXT_DIST_DIR || ".next");
const standalone = join(dist, "standalone");
if (
  !existsSync(join(standalone, "server.js")) ||
  lstatSync(standalone).isSymbolicLink()
)
  throw new Error("Expected a generated standalone build directory.");
const directories = [
  "data/local-demo",
  "data/media",
  "backups",
  "test-results",
  "test-results-local",
];
if (process.env.MEDIA_STORAGE_PATH) {
  const custom = relative(root, resolve(process.env.MEDIA_STORAGE_PATH))
    .split(sep)
    .join("/");
  if (custom && !custom.startsWith("../") && custom !== "..")
    directories.push(custom);
}
function privateRuntime(file) {
  const path = file.split(sep).join("/");
  return (
    directories.some(
      (directory) => path === directory || path.startsWith(directory + "/"),
    ) ||
    /^data\/(auth|checkout|orders|shipping)\.sqlite(?:-.*)?$/.test(path) ||
    /^data\/[^/]+\.env$/.test(path) ||
    /^\.env/.test(path) ||
    /^\.next-local[^/]*(\/|$)/.test(path) ||
    path === "biome.json"
  );
}
function removeGenerated(path) {
  const file = resolve(standalone, path);
  if (!file.startsWith(standalone + sep))
    throw new Error("Invalid generated file path.");
  if (!existsSync(file)) return;
  const parent = realpathSync(dirname(file));
  if (parent !== standalone && !parent.startsWith(standalone + sep))
    throw new Error("Generated data path escapes standalone directory.");
  rmSync(file, { recursive: true, force: true });
}
function traces(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory()
      ? traces(join(directory, item.name))
      : item.name.endsWith(".nft.json")
        ? [join(directory, item.name)]
        : [],
  );
}
let removed = 0;
for (const trace of traces(join(dist, "server"))) {
  const data = JSON.parse(readFileSync(trace, "utf8"));
  const rejected = (data.files || []).filter((file) =>
    privateRuntime(relative(root, resolve(dirname(trace), file))),
  );
  if (!rejected.length) continue;
  data.files = data.files.filter((file) => !rejected.includes(file));
  for (const file of rejected) {
    if (data.fileHashes && !Array.isArray(data.fileHashes))
      delete data.fileHashes[file];
    removeGenerated(relative(root, resolve(dirname(trace), file)));
    removed++;
  }
  writeFileSync(trace, JSON.stringify(data));
  const copy = join(standalone, relative(root, trace));
  if (existsSync(copy)) writeFileSync(copy, JSON.stringify(data));
}
for (const directory of directories) removeGenerated(directory);
for (const item of readdirSync(standalone))
  if (privateRuntime(item)) removeGenerated(item);
if (existsSync(join(standalone, "data")))
  for (const item of readdirSync(join(standalone, "data")))
    if (privateRuntime("data/" + item)) removeGenerated("data/" + item);
console.log(
  `Build data check passed: ${removed} runtime trace entries excluded. Source databases and uploaded images were not modified.`,
);
