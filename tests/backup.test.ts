import { it, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
it("backs up/restores actual SQLite contents and refuses corruption or overwrites", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dz-backup-test-"));
  try {
    const file = join(dir, "source.sqlite");
    const db = new DatabaseSync(file);
    await db.exec(
      "CREATE TABLE example(value TEXT);INSERT INTO example VALUES('fixture');",
    );
    await db.close();
    const env = {
      ...process.env,
      AUTH_DATABASE_PATH: file,
      ORDERS_DATABASE_PATH: file,
      SHIPPING_DATABASE_PATH: file,
      CHECKOUT_DATABASE_PATH: file,
      GEOGRAPHY_DATABASE_PATH: file,
    };
    const run = (script: string, args: string[]) =>
      execFileSync(process.execPath, [script, ...args], { env, stdio: "pipe" });
    run("scripts/backup.mjs", [join(dir, "backup")]);
    run("scripts/restore.mjs", [join(dir, "backup"), join(dir, "restored")]);
    const restored = new DatabaseSync(join(dir, "restored/orders.sqlite"));
    expect(
      (await restored.prepare("SELECT value FROM example").get())?.value,
    ).toBe("fixture");
    await restored.close();
    expect(() =>
      run("scripts/restore.mjs", [join(dir, "backup"), join(dir, "restored")]),
    ).toThrow();
    const bytes = readFileSync(join(dir, "backup/orders.sqlite"));
    bytes[100] ^= 1;
    writeFileSync(join(dir, "backup/orders.sqlite"), bytes);
    expect(() =>
      run("scripts/restore.mjs", [join(dir, "backup"), join(dir, "corrupt")]),
    ).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
