import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { Pool } from "pg";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Session } from "@shopify/shopify-api";
import { accountLogin, sessionMerchant } from "../src/modules/auth/store";
import { saveConnection } from "../src/modules/integrations/shopify/connections";
import { closeStoragePool } from "../src/modules/storage/database";
import { embeddedRequest } from "../src/modules/embedded/http";
import { defaultFormSettings } from "../src/modules/forms/settings";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";
const base = process.env.POSTGRES_TEST_URL;
const shop = "embedded-fixture.myshopify.com",
  secret = "synthetic-embedded-secret",
  app = "https://app.example.test";
let admin: Pool,
  schema: string,
  directory: string,
  merchant: string,
  other: string,
  cookie: string;
function jwt(extra: Record<string, unknown> = {}, key = secret) {
  const now = Math.floor(Date.now() / 1000),
    head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    );
  const payload = Buffer.from(
    JSON.stringify({
      aud: "fixture-client",
      iss: `https://${shop}/admin`,
      dest: `https://${shop}`,
      sub: "1234",
      sid: "fixture-sid",
      iat: now,
      nbf: now,
      exp: now + 60,
      ...extra,
    }),
  ).toString("base64url");
  return (
    head +
    "." +
    payload +
    "." +
    createHmac("sha256", key)
      .update(head + "." + payload)
      .digest("base64url")
  );
}
function req(
  operation: string,
  token: string | null = jwt(),
  body?: unknown,
  origin = app,
) {
  return new Request(`${app}/api/embedded/${operation}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json", origin } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
describe.skipIf(!base)("App Bridge session tenant isolation", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: base });
    schema = "em_" + randomUUID().replaceAll("-", "");
    directory = mkdtempSync(join(tmpdir(), "dz-em-"));
    const db = await admin.connect();
    try {
      await db.query("BEGIN");
      await db.query(`CREATE SCHEMA ${schema}`);
      await db.query("SELECT set_config('search_path',$1,true)", [schema]);
      await db.query(readFileSync("scripts/postgres-schema.sql", "utf8"));
      await db.query("COMMIT");
    } finally {
      db.release();
    }
    const url = new URL(base!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    vi.stubEnv("DATABASE_URL", url.toString());
    for (const name of ["AUTH", "CHECKOUT", "SHIPPING", "ORDERS"])
      vi.stubEnv(name + "_DATABASE_PATH", join(directory, name + ".sqlite"));
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SHOPIFY_CLIENT_ID", "fixture-client");
    vi.stubEnv("SHOPIFY_CLIENT_SECRET", secret);
    vi.stubEnv(
      "SHOPIFY_REDIRECT_URI",
      app + "/api/integrations/shopify/callback",
    );
    vi.stubEnv("SHOPIFY_SHOP", shop);
    vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", randomBytes(32).toString("hex"));
    vi.stubEnv("DZ_SHOPIFY_EMBEDDED", "1");
    vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC", "0");
    for (const flag of [
      "DZ_LOCAL_DEMO",
      "DZ_BOOTSTRAP_MODE",
      "DZ_DISABLE_EXTERNAL_INTEGRATIONS",
      "DZ_AUTH_TEST_BYPASS",
    ])
      vi.stubEnv(flag, "");
    cookie = await accountLogin(
      "embedded@example.test",
      "fixture-password",
      "Embedded",
    );
    merchant = (await sessionMerchant(cookie))!;
    const second = await accountLogin(
      "second@example.test",
      "fixture-password",
      "Second",
    );
    other = (await sessionMerchant(second))!;
    for (const [id, domain, shopId] of [
      [merchant, shop, "gid://shopify/Shop/91"],
      [other, "other-fixture.myshopify.com", "gid://shopify/Shop/92"],
    ])
      await saveConnection(
        id,
        domain,
        "synthetic-offline-access",
        "read_products",
        new Session({
          id: `offline_${domain}`,
          shop: domain,
          state: "",
          isOnline: false,
          accessToken: "synthetic-offline-access",
          scope: "read_products",
        }),
        shopId,
      );
    const conn = await admin.connect();
    try {
      await conn.query("SELECT set_config('search_path',$1,false)", [schema]);
      for (const id of [merchant, other])
        await conn.query("INSERT INTO form_settings VALUES($1,$2)", [
          id,
          JSON.stringify({
            ...defaultFormSettings,
            title: id === merchant ? "متجري" : "متجر آخر",
          }),
        ]);
    } finally {
      conn.release();
    }
  }, 30000);
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  afterAll(async () => {
    await closeStoragePool();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  });
  it("accepts an official-SDK-verified JWT without any cookie and exposes only the bound shop", async () => {
    const r = await embeddedRequest(req("session"), "session");
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b).toEqual({ connected: true, shop });
    expect(JSON.stringify(b)).not.toContain(secret);
  });
  it("ignores merchant cookies and resolves settings from the signed dest", async () => {
    const r = req("form-config");
    r.headers.set("cookie", `dz_session=${cookie}`);
    const out = await embeddedRequest(r, "form-config");
    expect((await out.json()).title).toBe("متجري");
    const second = await embeddedRequest(
      req(
        "form-config",
        jwt({
          dest: "https://other-fixture.myshopify.com",
          iss: "https://other-fixture.myshopify.com/admin",
        }),
      ),
      "form-config",
    );
    expect((await second.json()).title).toBe("متجر آخر");
  });
  it.each([
    "missing",
    "wrong-signature",
    "audience",
    "issuer",
    "destination",
    "expired",
    "future",
    "missing-sub",
    "missing-exp",
  ])("rejects %s session credentials without leaking JWTs", async (kind) => {
    const now = Math.floor(Date.now() / 1000);
    let token: string | null = jwt();
    if (kind === "missing") token = null;
    if (kind === "wrong-signature") token = jwt({}, "different-secret");
    if (kind === "audience") token = jwt({ aud: "another-app" });
    if (kind === "issuer")
      token = jwt({ iss: "https://other-fixture.myshopify.com/admin" });
    if (kind === "destination")
      token = jwt({ dest: `https://${shop}/untrusted` });
    if (kind === "expired")
      token = jwt({ iat: now - 120, nbf: now - 120, exp: now - 30 });
    if (kind === "future")
      token = jwt({ iat: now + 60, nbf: now + 60, exp: now + 120 });
    if (kind === "missing-sub") token = jwt({ sub: undefined });
    if (kind === "missing-exp") token = jwt({ exp: undefined });
    const r = await embeddedRequest(req("form-config", token), "form-config");
    expect(r.status).toBe(401);
    const text = await r.text();
    if (token) expect(text).not.toContain(token);
    expect(text).not.toContain(secret);
  });
  it("does not use a standalone cookie to authorize the embedded API", async () => {
    const r = req("session", null);
    r.headers.set("cookie", `dz_session=${cookie}`);
    expect((await embeddedRequest(r, "session")).status).toBe(401);
  });
  it.each(["store", "shop", "merchantId"])(
    "rejects a browser-selected %s tenant",
    async (key) => {
      const r = await embeddedRequest(
        req(`form-config?${key}=${other}`),
        "form-config",
      );
      expect(r.status).toBe(403);
    },
  );
  it("rejects a correctly signed token for an uninstalled shop", async () => {
    const token = jwt({
      dest: "https://missing-fixture.myshopify.com",
      iss: "https://missing-fixture.myshopify.com/admin",
    });
    expect(
      (await embeddedRequest(req("session", token), "session")).status,
    ).toBe(403);
  });
  it("rejects cross-origin mutation before saving", async () => {
    expect(
      (
        await embeddedRequest(
          req(
            "form-config",
            jwt(),
            defaultFormSettings,
            "https://attacker.example",
          ),
          "form-config",
        )
      ).status,
    ).toBe(403);
  });
  it("reads preview products only from the bound Shopify cache without API calls or local product fallback", async () => {
    const product = {
      id: "gid://shopify/Product/7",
      name: "Shopify fixture",
      demo: false,
      active: true,
      variants: [
        {
          id: "gid://shopify/ProductVariant/71",
          name: "Default",
          priceMinor: 120000,
          stock: 100,
        },
      ],
    };
    const payload = {
      products: [product, { ...product, id: "demo-local", demo: true }],
      discount: { type: "none", value: 0 },
      revision: 1,
    };
    const db = await admin.connect();
    try {
      await db.query("SELECT set_config('search_path',$1,false)", [schema]);
      await db.query("INSERT INTO shopify_catalog VALUES($1,$2,$3,$4,1)", [
        merchant,
        "gid://shopify/Shop/91",
        JSON.stringify(payload),
        new Date().toISOString(),
      ]);
    } finally {
      db.release();
    }
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const current = await (
      await embeddedRequest(req("catalog"), "catalog")
    ).json();
    expect(current.products).toHaveLength(1);
    expect(current.products[0].id).toBe(product.id);
    expect(fetch).not.toHaveBeenCalled();
    const second = await (
      await embeddedRequest(
        req(
          "catalog",
          jwt({
            dest: "https://other-fixture.myshopify.com",
            iss: "https://other-fixture.myshopify.com/admin",
          }),
        ),
        "catalog",
      )
    ).json();
    expect(second.products).toHaveLength(0);
  });
  it("saves only current-shop settings and creates no local orders or sync jobs", async () => {
    const changed = {
      ...defaultFormSettings,
      title: "تصميم محفوظ",
      fontFamily: "serif",
      fontSize: 18,
      contact: { name: "optional", phone: "required", address: "hidden" },
    };
    expect(
      (await embeddedRequest(req("form-config", jwt(), changed), "form-config"))
        .status,
    ).toBe(200);
    const current = await (
      await embeddedRequest(req("form-config"), "form-config")
    ).json();
    expect(current).toMatchObject({
      title: "تصميم محفوظ",
      fontFamily: "serif",
      fontSize: 18,
    });
    const second = await (
      await embeddedRequest(
        req(
          "form-config",
          jwt({
            dest: "https://other-fixture.myshopify.com",
            iss: "https://other-fixture.myshopify.com/admin",
          }),
        ),
        "form-config",
      )
    ).json();
    expect(second.title).toBe("متجر آخر");
    const db = await admin.connect();
    try {
      await db.query("SELECT set_config('search_path',$1,false)", [schema]);
      expect(
        (await db.query("SELECT count(*)::int AS count FROM orders")).rows[0]
          .count,
      ).toBe(0);
      expect(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM shopify_order_outbox",
          )
        ).rows[0].count,
      ).toBe(0);
    } finally {
      db.release();
    }
    expect(process.env.DZ_SHOPIFY_ORDER_SYNC).toBe("0");
  });
  it("requires valid fixed geography and rejects injected tenant fields in saved settings", async () => {
    expect(
      (
        await embeddedRequest(
          req("form-config", jwt(), {
            ...defaultFormSettings,
            merchantId: other,
          }),
          "form-config",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await embeddedRequest(
          req("form-config", jwt(), {
            ...defaultFormSettings,
            elements: { ...defaultFormSettings.elements, geography: false },
            fixedWilaya: "11",
            fixedCommune: "dz:commune:1",
          }),
          "form-config",
        )
      ).status,
    ).toBe(422);
  });
  it("authorizes the shared preview API by JWT and configured origin behind a reverse proxy, with read-only GraphQL", async () => {
    const fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.query).toMatch(/^query /);
      expect(body.query).not.toMatch(/mutation|orderCreate/);
      return Response.json(
        {
          data: {
            shop: {
              id: "gid://shopify/Shop/91",
              currencyCode: "DZD",
              primaryDomain: { url: "https://fixture-store.example" },
            },
            product: {
              id: "gid://shopify/Product/7",
              title: "Fixture",
              status: "ACTIVE",
              onlineStoreUrl: "https://fixture-store.example/products/fixture",
              featuredImage: null,
              variants: {
                nodes: [
                  {
                    id: "gid://shopify/ProductVariant/71",
                    title: "Default",
                    price: "1200.00",
                    inventoryQuantity: 100,
                    image: null,
                    selectedOptions: [],
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
        { headers: { "x-shopify-api-version": "2026-10" } },
      );
    });
    vi.stubGlobal("fetch", fetch);
    const target =
      "preview/bootstrap?product=gid://shopify/Product/7&origin=" +
      encodeURIComponent(app);
    const internal = new Request(
      "http://internal:10000/api/embedded/" + target,
      { headers: { authorization: `Bearer ${jwt()}` } },
    );
    const response = await embeddedRequest(internal, "preview/bootstrap");
    expect(response.status).toBe(200);
    const bootstrap = await response.json();
    expect(bootstrap.phase).toBe(2);
    expect(bootstrap.submission).toBe("validate_only");
    const quote = await embeddedRequest(
      req("preview/quote", jwt(), {
        context: bootstrap.context,
        input: {
          productId: "gid://shopify/Product/7",
          variantId: "gid://shopify/ProductVariant/71",
          quantity: 1,
          mode: "legacy58",
          wilayaCode: "11",
          communeId: "dz:commune:359",
        },
      }),
      "preview/quote",
    );
    expect(quote.status).toBe(200);
    expect((await quote.json()).subtotalMinor).toBe(120000);
    const denied = await embeddedRequest(
      req(
        "preview/bootstrap?product=gid://shopify/Product/7&origin=https://attacker.example",
      ),
      "preview/bootstrap",
    );
    expect(denied.status).toBe(403);
  });
  it("does not expose any order creation or OAuth operations", async () => {
    for (const op of ["orders", "trial", "oauth", "refresh", "create"])
      expect(
        (await embeddedRequest(req(op, jwt(), { action: "create" }), op))
          .status,
      ).toBe(404);
  });
  it("keeps the existing merchant API protected against JWT-only direct access", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const r = new NextRequest(app + "/api/orders", {
        headers: { authorization: `Bearer ${jwt()}` },
      });
      expect((await proxy(r)).status).toBe(401);
    } finally {
      vi.stubEnv("NODE_ENV", "test");
    }
  });
  it("sets constrained frame ancestors and never interpolates arbitrary framing hosts", async () => {
    const r = await proxy(
      new NextRequest(app + "/shopify/builder?shop=evil.example"),
    );
    expect(r.headers.get("content-security-policy")).toBe(
      "frame-ancestors https://admin.shopify.com;",
    );
  });
});
