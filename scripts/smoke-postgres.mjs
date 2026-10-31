import { Pool } from "pg";
import { spawn } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { once } from "node:events";
if (!process.env.DATABASE_URL)
  throw new Error(
    "Run through scripts/with-postgres.mjs or supply DATABASE_URL.",
  );
const schema = "dz_smoke_" + randomUUID().replaceAll("-", "");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let child;
let created = false;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
try {
  await pool.query(`CREATE SCHEMA ${schema}`);
  created = true;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("options", `-c search_path=${schema}`);
  child = spawn("npm", ["start", "--", "--port", "3001"], {
    env: {
      ...process.env,
      DATABASE_URL: url.toString(),
      DZ_AUTH_TEST_BYPASS: "1",
    },
    stdio: "ignore",
    detached: process.platform !== "win32",
  });
  const base = "http://127.0.0.1:3001";
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(ready, "Production readiness failed");
  const request = (path, body, cookie) =>
    fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        origin: base,
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const register = async (prefix) => {
    const r = await request("/api/auth", {
      action: "register",
      email: prefix + randomUUID() + "@example.test",
      name: "متجر اختبار",
      password: randomBytes(24).toString("hex"),
    });
    assert(r.ok, "Account registration failed");
    const cookie = r.headers.get("set-cookie")?.split(";")[0];
    assert(cookie, "Session missing");
    const profile = await (await request("/api/auth", null, cookie)).json();
    return { cookie, id: profile.merchantId };
  };
  const a = await register("a"),
    b = await register("b");
  assert(a.id && b.id && a.id !== b.id, "Tenant identity collision");
  assert(
    (await request("/api/orders")).status === 401,
    "Anonymous order read permitted",
  );
  assert(
    (
      await request("/api/shipping?mode=legacy58", {
        action: "settings",
        mode: "legacy58",
        revision: 0,
        genericOffice: true,
      })
    ).status === 401,
    "Anonymous admin mutation permitted",
  );
  const rate = {
    available: true,
    home: { enabled: true, price: 500 },
    office: { enabled: false, price: null },
    eta: "يومان",
  };
  assert(
    (
      await request(
        "/api/shipping",
        {
          action: "save",
          mode: "legacy58",
          revision: 0,
          entries: [{ scope: "default", target: "*", rule: rate }],
        },
        a.cookie,
      )
    ).ok,
    "Rate save failed",
  );
  const sb = await (
    await request("/api/shipping?mode=legacy58", null, b.cookie)
  ).json();
  assert(sb.entries.length === 0, "Shipping leaked across tenants");
  assert(
    (
      await request(
        "/api/checkout/discount",
        { revision: 0, discount: { type: "fixed", value: 25000 } },
        a.cookie,
      )
    ).ok,
    "Discount save failed",
  );
  const input = {
    productId: "demo-bag",
    variantId: "olive",
    quantity: 1,
    mode: "legacy58",
    wilayaCode: "28",
    communeId: "dz:commune:1006",
  };
  const q = await (
    await request(`/api/checkout/quote?store=${a.id}`, input)
  ).json();
  assert(
    q.methods.home.totalMinor === 415000,
    "Canonical tenant quote incorrect",
  );
  const qb = await (
    await request(`/api/checkout/quote?store=${b.id}`, input)
  ).json();
  assert(!qb.methods.home.available, "Public storefront leaked other rates");
  const payload = {
    customer: {
      ...input,
      name: "عميل اختبار",
      phone: "0551234567",
      method: "home",
      address: "شارع تجريبي رقم ١٢",
    },
    quoteToken: q.quoteToken,
  };
  const key = randomUUID();
  const create = () =>
    fetch(`${base}/api/orders?store=${a.id}`, {
      method: "POST",
      headers: {
        origin: base,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(payload),
    });
  const results = await Promise.all([create(), create()]);
  assert(
    results.every((r) => r.ok),
    "Concurrent create failed",
  );
  const orders = await Promise.all(results.map((r) => r.json()));
  assert(orders[0].orderId === orders[1].orderId, "Duplicate order persisted");
  const own = await (await request("/api/orders", null, a.cookie)).json();
  const other = await (
    await request(`/api/orders?store=${a.id}`, null, b.cookie)
  ).json();
  assert(
    own.orders.length === 1 && other.orders.length === 0,
    "Private tenant order isolation failed",
  );
  assert(
    (
      await request(
        "/api/orders",
        { action: "status", id: orders[0].orderId, status: "confirmed" },
        b.cookie,
      )
    ).status === 404,
    "Other tenant modified order",
  );
  assert(
    (await request("/api/orders?format=csv", null, a.cookie)).status === 200,
    "CSV export failed",
  );
  assert(
    (await request("/api/auth", { action: "logout" }, a.cookie)).ok,
    "Logout failed",
  );
  assert(
    (await request("/api/orders", null, a.cookie)).status === 401,
    "Revoked session accepted",
  );
  console.log(
    "Production PostgreSQL smoke passed: two accounts, private and public tenant isolation, pricing, concurrent idempotency, CSV and revoked sessions; dev auth bypass ignored.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (child?.pid) {
    const stopped = once(child, "exit");
    try {
      if (process.platform !== "win32") process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch {}
    await Promise.race([stopped, new Promise((r) => setTimeout(r, 2000))]);
  }
  if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.end();
}
