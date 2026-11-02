import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Session } from "@shopify/shopify-api";
import { accountLogin } from "../src/modules/auth/store";
import { POST as start } from "../src/app/api/integrations/shopify/start/route";
import { GET as callback } from "../src/app/api/integrations/shopify/callback/route";
import { GET as verify } from "../src/app/api/integrations/shopify/verify/route";
import { POST as webhook } from "../src/app/api/shopify/webhooks/route";
import {
  connectionCredential,
  connectionStatus,
  saveConnection,
} from "../src/modules/integrations/shopify/connections";

const shop = "fixture-shop.myshopify.com";
const origin = "https://app.example.test";
const agent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const secret = "fixture-client-secret";
let directory: string;
let sessionCookie: string;
let merchant: string;
let calls: string[];

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "dz-shopify-auth-"));
  vi.stubEnv("AUTH_DATABASE_PATH", join(directory, "auth.sqlite"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("DZ_LOCAL_DEMO", "");
  vi.stubEnv("DZ_DISABLE_EXTERNAL_INTEGRATIONS", "");
  vi.stubEnv("SHOPIFY_CLIENT_ID", "fixture-client-id");
  vi.stubEnv("SHOPIFY_CLIENT_SECRET", secret);
  vi.stubEnv("SHOPIFY_SHOP", shop);
  vi.stubEnv(
    "SHOPIFY_REDIRECT_URI",
    origin + "/api/integrations/shopify/callback",
  );
  vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", randomBytes(32).toString("hex"));
  const token = await accountLogin(
    "fixture@example.test",
    "fixture-password-only",
    "Fixture merchant",
  );
  const { sessionMerchant } = await import("../src/modules/auth/store");
  merchant = (await sessionMerchant(token))!;
  sessionCookie = `dz_session=${token}`;
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      calls.push(url);
      const body = JSON.parse(String(options?.body ?? "{}"));
      if (url === `https://${shop}/admin/oauth/access_token`) {
        expect(options?.redirect).toBe("error");
        return Response.json({
          access_token: "fixture-access-token",
          scope: "read_products",
          expires_in: 3600,
          refresh_token: "fixture-refresh-token",
          refresh_token_expires_in: 2592000,
        });
      }
      expect(url).toBe(`https://${shop}/admin/api/2026-10/graphql.json`);
      if (body.query.includes("DzVerifyShop"))
        return Response.json({
          data: {
            shop: {
              id: "gid://shopify/Shop/1",
              name: "Fixture",
              myshopifyDomain: shop,
            },
          },
        });
      if (body.query.includes("DzUninstallSubscriptions"))
        return Response.json({ data: { webhookSubscriptions: { nodes: [] } } });
      if (body.query.includes("DzRegisterUninstall"))
        return Response.json({
          data: {
            webhookSubscriptionCreate: {
              webhookSubscription: {
                id: "gid://shopify/WebhookSubscription/1",
              },
              userErrors: [],
            },
          },
        });
      throw new Error("Unexpected mocked transport request");
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

function beginRequest(
  overrides: Record<string, string> = {},
  inputShop = shop,
) {
  return new Request(origin + "/api/integrations/shopify/start", {
    method: "POST",
    headers: {
      origin,
      cookie: sessionCookie,
      "user-agent": agent,
      ...overrides,
    },
    body: JSON.stringify({ shop: inputShop }),
  });
}
async function authorization() {
  const response = await start(beginRequest());
  expect(response.status).toBe(200);
  const url = new URL((await response.json()).url);
  const cookies = response.headers.getSetCookie();
  expect(
    cookies.some(
      (cookie) =>
        /HttpOnly/i.test(cookie) &&
        /Secure/i.test(cookie) &&
        /SameSite=Lax/i.test(cookie),
    ),
  ).toBe(true);
  const params = new URLSearchParams({
    code: "fixture-code",
    shop,
    state: url.searchParams.get("state")!,
    timestamp: String(Math.floor(Date.now() / 1000)),
  });
  const message = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  params.set(
    "hmac",
    createHmac("sha256", secret).update(message).digest("hex"),
  );
  return {
    params,
    cookies: cookies.map((cookie) => cookie.split(";")[0]).join("; "),
  };
}
function callbackRequest(params: URLSearchParams, cookies: string) {
  return new Request(origin + "/api/integrations/shopify/callback?" + params, {
    headers: { cookie: cookies, "user-agent": agent },
  });
}
function uninstallRequest(
  body = JSON.stringify({ id: 1, myshopify_domain: shop }),
  changes: Record<string, string> = {},
) {
  return new Request(origin + "/api/shopify/webhooks", {
    method: "POST",
    body,
    headers: {
      "X-Shopify-Hmac-Sha256": createHmac("sha256", secret)
        .update(body)
        .digest("base64"),
      "X-Shopify-Topic": "app/uninstalled",
      "X-Shopify-Shop-Domain": shop,
      "X-Shopify-API-Version": "2026-10",
      "X-Shopify-Webhook-Id": "fixture-delivery-1",
      "X-Shopify-Triggered-At": new Date(Date.now() + 1000).toISOString(),
      ...changes,
    },
  });
}

it("requires an authenticated merchant, canonical origin and authorized shop before OAuth", async () => {
  expect((await start(beginRequest({ cookie: "" }))).status).toBe(401);
  expect(
    (await start(beginRequest({ origin: "https://evil.example.test" }))).status,
  ).toBe(403);
  expect(
    (await start(beginRequest({}, "other-shop.myshopify.com"))).status,
  ).toBe(403);
  expect(calls).toEqual([]);
});
it("completes SDK OAuth with browser binding, verifies the shop, stores encrypted refresh tokens and blocks replay", async () => {
  const { params, cookies } = await authorization();
  const response = await callback(callbackRequest(params, cookies));
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(origin + "/dashboard");
  expect((await connectionStatus(merchant)).connected).toBe(true);
  expect((await connectionCredential(merchant)).accessToken).toBe(
    "fixture-access-token",
  );
  const bytes = readFileSync(join(directory, "auth.sqlite"));
  expect(bytes.includes(Buffer.from("fixture-access-token"))).toBe(false);
  expect(bytes.includes(Buffer.from("fixture-refresh-token"))).toBe(false);
  const previous = calls.length;
  expect((await callback(callbackRequest(params, cookies))).status).toBe(400);
  expect(calls.length).toBe(previous);
  const result = await verify(
    new Request(origin + "/api/integrations/shopify/verify", {
      headers: { cookie: sessionCookie },
    }),
  );
  expect((await result.json()).verified).toBe(true);
});
it("rejects signed callbacks in another browser before token exchange", async () => {
  const { params } = await authorization();
  expect((await callback(callbackRequest(params, ""))).status).toBe(400);
  expect(calls).toEqual([]);
  expect((await connectionStatus(merchant)).connected).toBe(false);
});
it("rejects tampered and duplicate callback parameters without consuming the valid session", async () => {
  const { params, cookies } = await authorization();
  const bad = new URLSearchParams(params);
  bad.append("shop", shop);
  expect((await callback(callbackRequest(bad, cookies))).status).toBe(400);
  expect(calls).toEqual([]);
  expect((await callback(callbackRequest(params, cookies))).status).toBe(303);
});
it("refreshes expiring encrypted sessions once even for concurrent requests", async () => {
  const session = new Session({
    id: `offline_${shop}`,
    shop,
    state: "",
    isOnline: false,
    scope: "read_products",
    accessToken: "expired-fixture",
    expires: new Date(Date.now() - 1000),
    refreshToken: "old-refresh-fixture",
    refreshTokenExpires: new Date(Date.now() + 86400000),
  });
  await saveConnection(
    merchant,
    shop,
    session.accessToken!,
    "read_products",
    session,
  );
  const credentials = await Promise.all([
    connectionCredential(merchant),
    connectionCredential(merchant),
  ]);
  expect(credentials.map((value) => value.accessToken)).toEqual([
    "fixture-access-token",
    "fixture-access-token",
  ]);
  expect(calls).toHaveLength(1);
});
it("verifies uninstall HMAC, isolates shops, handles duplicate delivery and does not remove a reinstallation", async () => {
  await saveConnection(merchant, shop, "fixture-token", "read_products");
  await saveConnection(
    "other-merchant",
    "other-shop.myshopify.com",
    "other-fixture-token",
    "read_products",
  );
  expect(
    (
      await webhook(
        uninstallRequest(undefined, { "X-Shopify-Hmac-Sha256": "invalid" }),
      )
    ).status,
  ).toBe(401);
  expect((await connectionStatus(merchant)).connected).toBe(true);
  const stale = uninstallRequest(undefined, {
    "X-Shopify-Webhook-Id": "old",
    "X-Shopify-Triggered-At": new Date(Date.now() - 60000).toISOString(),
  });
  expect((await webhook(stale)).status).toBe(200);
  expect((await connectionStatus(merchant)).connected).toBe(true);
  // New event must use a different body from the stale delivery.
  const body = JSON.stringify({
    id: 1,
    myshopify_domain: shop,
    updated_at: new Date().toISOString(),
  });
  expect((await webhook(uninstallRequest(body))).status).toBe(200);
  expect((await connectionStatus(merchant)).connected).toBe(false);
  expect((await connectionStatus("other-merchant")).connected).toBe(true);
  await saveConnection(merchant, shop, "new-fixture-token", "read_products");
  expect((await webhook(uninstallRequest(body))).status).toBe(200);
  expect((await connectionCredential(merchant)).accessToken).toBe(
    "new-fixture-token",
  );
});
it("disables OAuth, live verification and webhooks in local demo mode", async () => {
  vi.stubEnv("DZ_LOCAL_DEMO", "1");
  expect((await start(beginRequest())).status).toBe(503);
  expect(
    (await callback(new Request(origin + "/api/integrations/shopify/callback")))
      .status,
  ).toBe(503);
  expect(
    (await verify(new Request(origin + "/api/integrations/shopify/verify")))
      .status,
  ).toBe(503);
  expect((await webhook(uninstallRequest())).status).toBe(503);
  expect(calls).toEqual([]);
});

it("does not persist authorization when Shopify omits the requested product scope", async () => {
  const { params, cookies } = await authorization();
  vi.mocked(fetch).mockImplementationOnce(async () =>
    Response.json({
      access_token: "fixture-access-token",
      scope: "",
      expires_in: 3600,
      refresh_token: "fixture-refresh-token",
      refresh_token_expires_in: 2592000,
    }),
  );
  expect((await callback(callbackRequest(params, cookies))).status).toBe(400);
  expect((await connectionStatus(merchant)).connected).toBe(false);
});

it("does not mark a connection ready if required webhook registration fails", async () => {
  const transport = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, options) => {
    const body = JSON.parse(String(options?.body ?? "{}"));
    if (body.query?.includes("DzRegisterUninstall"))
      return Response.json({
        data: {
          webhookSubscriptionCreate: {
            webhookSubscription: null,
            userErrors: [{ message: "fixture-rejected" }],
          },
        },
      });
    return transport(input, options);
  });
  const { params, cookies } = await authorization();
  const response = await callback(callbackRequest(params, cookies));
  expect(response.status).toBe(400);
  expect(await response.text()).not.toContain("fixture-rejected");
  expect((await connectionStatus(merchant)).connected).toBe(false);
});

it("keeps shop ownership isolated and refuses expired refresh credentials", async () => {
  const session = new Session({
    id: `offline_${shop}`,
    shop,
    state: "",
    isOnline: false,
    scope: "read_products",
    accessToken: "expired-fixture",
    expires: new Date(Date.now() - 1000),
    refreshToken: "expired-refresh-fixture",
    refreshTokenExpires: new Date(Date.now() - 1000),
  });
  await saveConnection(
    merchant,
    shop,
    session.accessToken!,
    "read_products",
    session,
  );
  await expect(
    saveConnection(
      "attacker-merchant",
      shop,
      "attacker-fixture",
      "read_products",
    ),
  ).rejects.toThrow();
  await expect(connectionCredential(merchant)).rejects.toThrow("expired");
  expect(calls).toEqual([]);
});

it("rejects forged webhook shop attribution and oversized bodies, and protects verification", async () => {
  const mismatch = JSON.stringify({
    id: 1,
    myshopify_domain: "other-shop.myshopify.com",
  });
  expect((await webhook(uninstallRequest(mismatch))).status).toBe(400);
  expect((await webhook(uninstallRequest("x".repeat(262145)))).status).toBe(
    413,
  );
  expect(
    (await verify(new Request(origin + "/api/integrations/shopify/verify")))
      .status,
  ).toBe(401);
  expect(calls).toEqual([]);
});
