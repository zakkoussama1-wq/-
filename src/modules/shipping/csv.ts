import { entrySchema, type RuleEntry } from "./schema";
export const csvHeaders = [
  "النطاق",
  "المعرف",
  "متاح",
  "المنزل_مفعل",
  "سعر_المنزل",
  "المكتب_مفعل",
  "سعر_المكتب",
  "مدة_التوصيل",
];
const scopeLabels = {
  default: "افتراضي",
  wilaya: "ولاية",
  commune: "بلدية",
} as const;
function cell(value: string) {
  const safe = /^['=+@\-\t\r]/.test(value) ? "'" + value : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
export function exportShippingCsv(entries: RuleEntry[]): string {
  return (
    "\uFEFF" +
    [
      csvHeaders,
      ...entries.map((e) => [
        scopeLabels[e.scope],
        e.target,
        e.rule.available ? "1" : "0",
        e.rule.home.enabled ? "1" : "0",
        e.rule.home.price === null ? "" : String(e.rule.home.price),
        e.rule.office.enabled ? "1" : "0",
        e.rule.office.price === null ? "" : String(e.rule.office.price),
        e.rule.eta,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n") +
    "\r\n"
  );
}
/** Strict RFC-style quoted CSV; invalid imports never partially write. */
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += c;
      continue;
    }
    if (c === '"') {
      if (value || closed) throw new Error("صيغة اقتباس CSV غير صالحة.");
      quoted = true;
      continue;
    }
    if (c === "," || c === "\n" || c === "\r") {
      row.push(value);
      value = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
      }
      continue;
    }
    if (closed) throw new Error("يوجد نص بعد إغلاق اقتباس CSV.");
    value += c;
  }
  if (quoted) throw new Error("اقتباس CSV غير مغلق.");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}
export function importShippingCsv(text: string): RuleEntry[] {
  const rows = parseRows(text);
  if (JSON.stringify(rows.shift()) !== JSON.stringify(csvHeaders))
    throw new Error("عناوين CSV غير مطابقة. استخدم ملف التصدير قالبًا.");
  if (!rows.length || rows.length > 1611)
    throw new Error("يجب أن يحتوي CSV على ١–١٦١١ صفًا.");
  const seen = new Set<string>();
  return rows.map((row, index) => {
    try {
      if (row.length !== 8) throw new Error();
      const [
        label,
        target,
        available,
        homeEnabled,
        homePrice,
        officeEnabled,
        officePrice,
        eta,
      ] = row;
      const scope = (
        Object.keys(scopeLabels) as (keyof typeof scopeLabels)[]
      ).find((s) => scopeLabels[s] === label);
      if (!scope) throw new Error();
      const bool = (v: string) => {
        if (v !== "0" && v !== "1") throw new Error();
        return v === "1";
      };
      const price = (v: string) => {
        if (v === "") return null;
        if (!/^\d+(\.\d{1,2})?$/.test(v)) throw new Error();
        return Number(v);
      };
      const result = entrySchema.parse({
        scope,
        target,
        rule: {
          available: bool(available),
          home: { enabled: bool(homeEnabled), price: price(homePrice) },
          office: { enabled: bool(officeEnabled), price: price(officePrice) },
          eta:
            eta.startsWith("'") && /^['=+@\-\t\r]/.test(eta.slice(1))
              ? eta.slice(1)
              : eta,
        },
      });
      const key = scope + ":" + target;
      if (seen.has(key)) throw new Error();
      seen.add(key);
      return result;
    } catch {
      throw new Error(
        `صف CSV رقم ${index + 2} غير صالح أو مكرر. تحقق من المعرف والأسعار وحالات التفعيل.`,
      );
    }
  });
}
