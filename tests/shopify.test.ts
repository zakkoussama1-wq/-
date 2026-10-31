import { it, expect, afterAll } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  shopHostname,
  verifyOAuthQuery,
  oauthAuthorizeUrl,
  exchangeShopifyToken,
  shopifyGraphql,
} from "../src/modules/integrations/shopify/client";
import {
  createOAuthState,
  consumeOAuthState,
  saveConnection,
  connectionCredential,
  connectionStatus,
} from "../src/modules/integrations/shopify/connections";
const dir = mkdtempSync(join(tmpdir(), "dz-shopify-"));
process.env.AUTH_DATABASE_PATH = join(dir, "auth.sqlite");
process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
afterAll(() => rmSync(dir, { recursive: true, force: true }));
it("rejects arbitrary hosts and validates callback HMAC", () => {
  expect(() => shopHostname("127.0.0.1")).toThrow();
  expect(() => shopHostname("https://shop.myshopify.com/path")).toThrow();
  const p = new URLSearchParams({
    code: "code",
    shop: "shop.myshopify.com",
    state: "state",
  });
  p.set(
    "hmac",
    createHmac("sha256", "fixture")
      .update("code=code&shop=shop.myshopify.com&state=state")
      .digest("hex"),
  );
  expect(verifyOAuthQuery(p, "fixture")).toBe(true);
  p.set("code", "tampered");
  expect(verifyOAuthQuery(p, "fixture")).toBe(false);
  expect(
    oauthAuthorizeUrl({
      shop: "shop.myshopify.com",
      clientId: "client",
      state: "nonce",
      redirectUri: "https://example.test/callback",
      scopes: ["read_products"],
    }),
  ).toContain("/admin/oauth/authorize");
});
it("consumes OAuth state once and encrypts tokens bound to the tenant", async () => {
  const state = await createOAuthState("a", "shop.myshopify.com");
  await expect(
    consumeOAuthState(state, "other.myshopify.com"),
  ).rejects.toThrow();
  expect(await consumeOAuthState(state, "shop.myshopify.com")).toBe("a");
  await expect(
    consumeOAuthState(state, "shop.myshopify.com"),
  ).rejects.toThrow();
  await saveConnection(
    "a",
    "shop.myshopify.com",
    "fixture-token",
    "read_products",
  );
  expect(JSON.stringify(await connectionStatus("a"))).not.toContain(
    "fixture-token",
  );
  expect(await connectionStatus("b")).toEqual({ connected: false });
  await expect(connectionCredential("b")).rejects.toThrow();
  expect((await connectionCredential("a")).accessToken).toBe("fixture-token");
});
it("exchanges and queries only via supplied local mock transport", async () => {
  const token = await exchangeShopifyToken(
    {
      shop: "shop.myshopify.com",
      code: "code",
      clientId: "client",
      clientSecret: "fixture",
    },
    async () =>
      Response.json({ access_token: "fixture-token", scope: "read_products" }),
  );
  expect(token.accessToken).toBe("fixture-token");
  expect(
    await shopifyGraphql(
      "shop.myshopify.com",
      token.accessToken,
      "query { shop { name } }",
      {},
      async () => Response.json({ data: { shop: { name: "fixture" } } }),
    ),
  ).toEqual({ shop: { name: "fixture" } });
  await expect(
    shopifyGraphql(
      "shop.myshopify.com",
      token.accessToken,
      "bad",
      {},
      async () => Response.json({ errors: [{ message: "sensitive" }] }),
    ),
  ).rejects.toThrow("GraphQL");
});
