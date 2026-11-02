import { isLocalDemo } from "../../lib/local-demo";
import { Database as DatabaseSync } from "../storage/database";
import { mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export async function authDb() {
  const file = process.env.AUTH_DATABASE_PATH
    ? resolve(/* turbopackIgnore: true */ process.env.AUTH_DATABASE_PATH)
    : join(process.cwd(), "data", "auth.sqlite");
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  await db.exec("PRAGMA foreign_keys=ON");
  await db.exec(
    `PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY CHECK(id=1),salt TEXT NOT NULL,hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS auth_limits(bucket INTEGER PRIMARY KEY,count INTEGER NOT NULL);`,
  );
  await db.exec(
    "CREATE TABLE IF NOT EXISTS accounts(merchant_id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,salt TEXT NOT NULL,hash TEXT NOT NULL)",
  );
  if (
    !(await db.prepare("PRAGMA table_info(sessions)").all()).some(
      (c) => c.name === "merchant_id",
    )
  )
    await db.exec("ALTER TABLE sessions ADD COLUMN merchant_id TEXT");
  return db;
}
export async function authenticate(password: string, setup = false) {
  if (password.length < 12 || password.length > 200)
    throw new Error("كلمة المرور يجب أن تتكون من ١٢–٢٠٠ حرف.");
  const db = await authDb();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock("auth");
    const bucket = Math.floor(Date.now() / 60000);
    await db.prepare("DELETE FROM auth_limits WHERE bucket<?").run(bucket - 2);
    const count = Number(
      (
        await db
          .prepare("SELECT count FROM auth_limits WHERE bucket=?")
          .get(bucket)
      )?.count ?? 0,
    );
    if (count >= 10) throw new Error("محاولات كثيرة. حاول بعد دقيقة.");
    await db
      .prepare(
        "INSERT INTO auth_limits VALUES(?,1) ON CONFLICT(bucket) DO UPDATE SET count=auth_limits.count+1",
      )
      .run(bucket);
    await db.exec("COMMIT");
    await db.exec("BEGIN IMMEDIATE");
    await db.lock("auth");
    let owner = await db.prepare("SELECT * FROM owner WHERE id=1").get();
    if (setup) {
      if (owner) throw new Error("تم إعداد حساب المالك مسبقًا.");
      const salt = randomBytes(16).toString("hex");
      await db
        .prepare("INSERT INTO owner VALUES(1,?,?)")
        .run(salt, scryptSync(password, salt, 64).toString("hex"));
      owner = await db.prepare("SELECT * FROM owner WHERE id=1").get();
    }
    if (
      !owner ||
      !timingSafeEqual(
        scryptSync(password, String(owner.salt), 64),
        Buffer.from(String(owner.hash), "hex"),
      )
    )
      throw new Error("بيانات الدخول غير صحيحة.");
    const token = randomBytes(32).toString("hex");
    await db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    await db
      .prepare("INSERT INTO sessions(hash,expires) VALUES(?,?)")
      .run(
        createHash("sha256").update(token).digest("hex"),
        Date.now() + 8 * 3600000,
      );
    await db.exec("COMMIT");
    return token;
  } catch (e) {
    try {
      await db.exec("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    await db.close();
  }
}
export async function validSession(token: string) {
  if (isLocalDemo()) return true;
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const db = await authDb();
  try {
    return !!(await db
      .prepare("SELECT 1 FROM sessions WHERE hash=? AND expires>?")
      .get(createHash("sha256").update(token).digest("hex"), Date.now()));
  } finally {
    await db.close();
  }
}
export async function logout(token: string) {
  const db = await authDb();
  try {
    await db
      .prepare("DELETE FROM sessions WHERE hash=?")
      .run(createHash("sha256").update(token).digest("hex"));
  } finally {
    await db.close();
  }
}
export async function sessionMerchant(token: string): Promise<string | null> {
  if (isLocalDemo()) return "local-demo-merchant";
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const db = await authDb();
  try {
    const row = await db
      .prepare("SELECT merchant_id FROM sessions WHERE hash=? AND expires>?")
      .get(createHash("sha256").update(token).digest("hex"), Date.now());
    if (process.env.NODE_ENV === "production" && !row?.merchant_id) return null;
    return row
      ? String(
          row.merchant_id ??
            process.env.LOCAL_MERCHANT_ID ??
            "local-development-merchant",
        )
      : null;
  } finally {
    await db.close();
  }
}
export async function accountLogin(
  email: string,
  password: string,
  name?: string,
) {
  email = email.trim().toLowerCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    password.length < 12 ||
    password.length > 200
  )
    throw new Error("تحقق من البريد وكلمة المرور (١٢ حرفًا على الأقل).");
  const db = await authDb();
  try {
    await db.exec("BEGIN IMMEDIATE");
    await db.lock("auth");
    const bucket = Math.floor(Date.now() / 60000);
    const count = Number(
      (
        await db
          .prepare("SELECT count FROM auth_limits WHERE bucket=?")
          .get(bucket)
      )?.count ?? 0,
    );
    if (count >= 20) throw new Error("محاولات كثيرة. حاول لاحقًا.");
    await db.prepare("DELETE FROM auth_limits WHERE bucket<?").run(bucket - 2);
    await db
      .prepare(
        "INSERT INTO auth_limits VALUES(?,1) ON CONFLICT(bucket) DO UPDATE SET count=auth_limits.count+1",
      )
      .run(bucket);
    await db.exec("COMMIT");
    await db.exec("BEGIN IMMEDIATE");
    await db.lock("auth");
    if (name !== undefined) {
      if (name.trim().length < 2 || name.length > 100)
        throw new Error("أدخل اسم متجر صحيحًا.");
      const salt = randomBytes(16).toString("hex");
      const merchant = crypto.randomUUID();
      try {
        await db
          .prepare("INSERT INTO accounts VALUES(?,?,?,?,?)")
          .run(
            merchant,
            email,
            name.trim(),
            salt,
            scryptSync(password, salt, 64).toString("hex"),
          );
      } catch {
        throw new Error("تعذر إنشاء الحساب بهذا البريد.");
      }
    }
    const row = await db
      .prepare("SELECT * FROM accounts WHERE email=?")
      .get(email);
    const computed = scryptSync(
      password,
      String(row?.salt ?? "dummy-auth-salt"),
      64,
    );
    if (
      !row ||
      !timingSafeEqual(computed, Buffer.from(String(row.hash), "hex"))
    )
      throw new Error("بيانات الدخول غير صحيحة.");
    const token = randomBytes(32).toString("hex");
    await db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    await db
      .prepare("INSERT INTO sessions(hash,expires,merchant_id) VALUES(?,?,?)")
      .run(
        createHash("sha256").update(token).digest("hex"),
        Date.now() + 28800000,
        String(row.merchant_id),
      );
    await db.exec("COMMIT");
    return token;
  } catch (e) {
    try {
      await db.exec("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    await db.close();
  }
}
export async function merchantExists(id: string) {
  const db = await authDb();
  try {
    return !!(await db
      .prepare("SELECT 1 FROM accounts WHERE merchant_id=?")
      .get(id));
  } finally {
    await db.close();
  }
}
