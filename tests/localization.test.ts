import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { messages } from "../src/lib/messages";
function components(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const file = join(directory, item.name);
    return item.isDirectory()
      ? components(file)
      : file.endsWith(".tsx")
        ? [file]
        : [];
  });
}
describe("French and English interface coverage", () => {
  it("provides both translations for every static Arabic UI string", () => {
    const missing: string[] = [];
    for (const file of [
      ...components("src/components"),
      ...components("src/app"),
    ]) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      function visit(node: ts.Node) {
        if (ts.isStringLiteral(node) && /[\u0600-\u06ff]/.test(node.text)) {
          const key = node.text.replace(/\s+/g, " ").trim();
          if (!messages[key]?.en.trim() || !messages[key]?.fr.trim())
            missing.push(`${file}: ${key}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(missing).toEqual([]);
  });
  it("keeps localized default text free from untranslated Arabic except the multilingual language label", () => {
    for (const [key, translations] of Object.entries(messages)) {
      if (key === "Language / اللغة / Langue") continue;
      for (const language of ["fr", "en"] as const)
        expect(translations[language], `${language}: ${key}`).not.toMatch(
          /[\u0600-\u06ff]/,
        );
    }
  });
});
