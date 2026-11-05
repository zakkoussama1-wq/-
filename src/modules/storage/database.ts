import { postgresConfiguration } from "../../../scripts/postgres-configuration.mjs";
export { postgresConfiguration } from "../../../scripts/postgres-configuration.mjs";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
let pool: Pool | undefined;
function postgresPool() {
  if (!pool) pool = new Pool(postgresConfiguration(process.env.DATABASE_URL!));
  return pool;
}
function sql(text: string) {
  let i = 0;
  let result = text
    .replace(/\?/g, () => `$${++i}`)
    .replace(/BEGIN IMMEDIATE/g, "BEGIN")
    .replace(/expires INTEGER/g, "expires BIGINT");
  if (/INSERT OR IGNORE/i.test(result))
    result =
      result.replace(/INSERT OR IGNORE/i, "INSERT") + " ON CONFLICT DO NOTHING";
  return result;
}
const queues = new Map<string, Promise<void>>();
async function acquire(name: string) {
  const previous = queues.get(name) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => {
    release = r;
  });
  queues.set(
    name,
    previous.then(() => next),
  );
  await previous;
  return release;
}
/** Identical parameterized statement interface, async on both backends. */
export class Database {
  private sqlite?: DatabaseSync;
  private file: string;
  private release?: () => void;
  private attachedReleases: (() => void)[] = [];
  async attach(file: string, alias: string) {
    if (!this.sqlite) return "";
    if (!/^[a-z_]+$/.test(alias)) throw new Error("Invalid database alias");
    const release = await acquire(resolve(file));
    try {
      this.sqlite.prepare(`ATTACH DATABASE ? AS ${alias}`).run(resolve(file));
      this.attachedReleases.push(release);
      return alias + ".";
    } catch (e) {
      release();
      throw e;
    }
  }
  private async sqliteOperation<T>(operation: () => T): Promise<T> {
    if (this.release) return operation();
    const release = await acquire(this.file);
    try {
      return operation();
    } finally {
      release();
    }
  }
  async lock(name: string) {
    if (this.connection)
      await (
        await this.connection
      ).query("SELECT pg_advisory_xact_lock(hashtext($1))", [name]);
  }
  private connection?: Promise<PoolClient>;
  constructor(file: string, options?: { readOnly?: boolean }) {
    if (process.env.NODE_ENV === "production") {
      if (
        !process.env.DATABASE_URL ||
        !/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL)
      )
        throw new Error(
          "Production requires PostgreSQL; SQLite fallback is disabled",
        );
      if (
        process.env.DZ_LOCAL_DEMO === "1" ||
        process.env.DZ_AUTH_TEST_BYPASS === "1"
      )
        throw new Error("Development bypass is forbidden in production");
    }
    this.file = resolve(file);
    if (process.env.DATABASE_URL) this.connection = postgresPool().connect();
    else this.sqlite = new DatabaseSync(file, options ?? {});
  }
  async exec(text: string) {
    if (this.sqlite) {
      const begin = /^\s*BEGIN/i.test(text);
      const finish = /^\s*(COMMIT|ROLLBACK)/i.test(text);
      if (begin) {
        this.release = await acquire(this.file);
        try {
          this.sqlite.exec(text);
        } catch (e) {
          this.release();
          this.release = undefined;
          throw e;
        }
        return;
      }
      try {
        return await this.sqliteOperation(() => this.sqlite!.exec(text));
      } finally {
        if (finish) {
          this.release?.();
          this.release = undefined;
        }
      }
    }
    const statements = text
      .split(";")
      .filter((s) => s.trim() && !/^\s*PRAGMA/i.test(s))
      .map(sql)
      .join(";");
    if (statements) {
      const client = await this.connection!;
      const ddl = /^\s*(CREATE|ALTER)/i.test(statements);
      if (ddl) await client.query("SELECT pg_advisory_lock(174441)");
      try {
        await client.query(
          statements.replace(
            /ALTER TABLE sessions ADD COLUMN merchant_id/i,
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS merchant_id",
          ),
        );
      } finally {
        if (ddl) await client.query("SELECT pg_advisory_unlock(174441)");
      }
    }
  }
  prepare(text: string) {
    return {
      all: async (...params: (string | number | null)[]) => {
        if (this.sqlite)
          return this.sqliteOperation(() =>
            this.sqlite!.prepare(text).all(...params),
          );
        const client = await this.connection!;
        if (/^PRAGMA table_info\(sessions\)/.test(text))
          return (
            await client.query(
              "SELECT column_name AS name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='sessions'",
            )
          ).rows;
        return (await client.query(sql(text), params)).rows;
      },
      get: async (...params: (string | number | null)[]) => {
        if (this.sqlite)
          return this.sqliteOperation(() =>
            this.sqlite!.prepare(text).get(...params),
          );
        return (await (await this.connection!).query(sql(text), params))
          .rows[0];
      },
      run: async (...params: (string | number | null)[]) => {
        if (this.sqlite)
          return this.sqliteOperation(() =>
            this.sqlite!.prepare(text).run(...params),
          );
        const result = await (await this.connection!).query(sql(text), params);
        return { changes: result.rowCount ?? 0, lastInsertRowid: 0 };
      },
    };
  }
  async close() {
    if (this.sqlite) {
      this.sqlite.close();
      this.release?.();
      this.release = undefined;
      for (const release of this.attachedReleases) release();
      this.attachedReleases = [];
    } else (await this.connection!).release();
  }
}
export async function closeStoragePool() {
  await pool?.end();
  pool = undefined;
}
