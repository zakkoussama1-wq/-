import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../data/geography/", import.meta.url));
const read = (name) => JSON.parse(readFileSync(resolve(root, name), "utf8"));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const provenance = read("provenance.json");
for (const [name, hash] of Object.entries(provenance.files)) {
  assert(
    createHash("sha256")
      .update(readFileSync(resolve(root, name)))
      .digest("hex") === hash,
    `Source integrity mismatch: ${name}`,
  );
}
const base = read("sources/wadi/algeria-communes-58-wilayas.json");
const candidate = read("sources/wadi/algeria-communes-69-wilayas.json");
const reference = read("sources/islam/wilaya-commune.json");
const transfers = read("transfers-2026.json");
assert(
  base.length === 1541 && new Set(base.map((c) => c.id)).size === 1541,
  "Expected 1541 unique source commune IDs",
);
assert(
  candidate.length === 1541 && reference.length === 69,
  "Invalid reference sizes",
);
assert(
  new Set(transfers.map((c) => c.sourceId)).size === 108 &&
    transfers.length === 108,
  "Expected 108 reviewed transfers",
);
// Require an exact, one-to-one reviewed crosswalk for every secondary-reference transfer.
for (const w of reference.filter((w) => w.code >= 59)) {
  const expected = new Set(w.communes.map((c) => c.ascii));
  const actual = transfers.filter((t) => t.to === String(w.code));
  assert(
    expected.size === actual.length &&
      actual.every((t) => expected.has(t.referenceName)),
    `Reference transfer membership mismatch for ${w.code}`,
  );
  assert(
    new Set(actual.map((t) => t.referenceName)).size === actual.length,
    `Duplicate reference crosswalk for ${w.code}`,
  );
}
const moved = new Map(transfers.map((t) => [t.sourceId, t]));
const wilayas = new Map();
for (const c of base) {
  assert(
    Number.isSafeInteger(c.id) &&
      c.id > 0 &&
      /^\d{2}$/.test(c.wilaya_code) &&
      c.commune_name.trim() &&
      c.commune_name_ascii.trim(),
    "Invalid base schema",
  );
  const prev = wilayas.get(c.wilaya_code);
  assert(
    !prev ||
      (prev.nameAr === c.wilaya_name && prev.nameLatin === c.wilaya_name_ascii),
    "Conflicting wilaya names",
  );
  wilayas.set(c.wilaya_code, {
    id: `dz:wilaya:${c.wilaya_code}`,
    code: c.wilaya_code,
    nameAr: c.wilaya_name,
    nameLatin: c.wilaya_name_ascii,
  });
}
assert(wilayas.size === 58, "Expected 58 legacy wilayas");
for (const w of reference.filter((w) => w.code >= 59)) {
  const code = String(w.code);
  wilayas.set(code, {
    id: `dz:wilaya:${code}`,
    code,
    nameAr: w.arabic,
    nameLatin: w.ascii,
  });
}
const communes = base
  .map((c) => {
    const transfer = moved.get(c.id);
    if (transfer)
      assert(
        transfer.from === c.wilaya_code &&
          transfer.sourceName === c.commune_name_ascii,
        "Stale transfer crosswalk",
      );
    return {
      id: `dz:commune:${c.id}`,
      sourceId: c.id,
      nameAr: c.commune_name,
      nameLatin: c.commune_name_ascii,
      legacyWilayaCode: c.wilaya_code,
      updatedWilayaCode: transfer?.to ?? c.wilaya_code,
    };
  })
  .sort((a, b) => a.sourceId - b.sourceId);
// Compare every new wilaya with both its reference table and the transcribed law count.
const legalCounts = {
  59: 12,
  60: 8,
  61: 5,
  62: 4,
  63: 4,
  64: 6,
  65: 10,
  66: 8,
  67: 21,
  68: 23,
  69: 7,
};
for (const [code, count] of Object.entries(legalCounts)) {
  const actual = communes.filter((c) => c.updatedWilayaCode === code);
  assert(
    actual.length === count &&
      reference.find((w) => String(w.code) === code)?.communes.length === count,
    `Wrong transfer count for ${code}`,
  );
}
for (const mode of ["legacy", "updated"]) {
  const key = `${mode}WilayaCode`;
  const codes = new Set(communes.map((c) => c[key]));
  assert(
    codes.size === (mode === "legacy" ? 58 : 69),
    `Invalid ${mode} wilaya count`,
  );
  for (const c of communes)
    assert(wilayas.has(c[key]), `Orphan commune ${c.id}`);
}
const disagreements = communes
  .filter(
    (c) =>
      candidate.find((x) => x.id === c.sourceId)?.wilaya_code !==
      c.updatedWilayaCode,
  )
  .map((c) => ({
    sourceId: c.sourceId,
    name: c.nameAr,
    candidate: candidate.find((x) => x.id === c.sourceId)?.wilaya_code,
    reconciled: c.updatedWilayaCode,
  }));
const output =
  JSON.stringify(
    {
      version: 1,
      defaultMode: "legacy58",
      updatedVerification: "secondary-reference-only",
      wilayas: [...wilayas.values()].sort((a, b) =>
        a.code.localeCompare(b.code),
      ),
      communes,
    },
    null,
    2,
  ) + "\n";
const report =
  JSON.stringify(
    {
      legacyWilayas: 58,
      updatedWilayas: 69,
      communes: 1541,
      transfers: 108,
      candidateDisagreements: disagreements,
      primaryVerification: provenance.primaryVerification,
    },
    null,
    2,
  ) + "\n";
if (process.argv.includes("--check")) {
  assert(
    readFileSync(resolve(root, "catalog.json"), "utf8") === output,
    "Generated catalog is stale",
  );
  assert(
    readFileSync(resolve(root, "audit.json"), "utf8") === report,
    "Audit is stale",
  );
} else {
  writeFileSync(resolve(root, "catalog.json"), output);
  writeFileSync(resolve(root, "audit.json"), report);
}
console.log(
  `Geography validated: 58/69 wilayas, 1541 communes, 108 transfers; ${disagreements.length} corrected candidate parent assignments. Official PDF verification pending.`,
);
