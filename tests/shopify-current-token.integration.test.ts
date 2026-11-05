import { GET as checkScopes } from "../src/app/api/integrations/shopify/scopes/route";
import { afterEach, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { Session } from "@shopify/shopify-api";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { accountLogin, sessionMerchant } from "../src/modules/auth/store";
import {
  saveConnection,
  connectionCredential,
} from "../src/modules/integrations/shopify/connections";
import { closeStoragePool } from "../src/modules/storage/database";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it.skipIf(!process.env.POSTGRES_TEST_URL)(
  "current-token inspection never refreshes credentials and isolates real merchant sessions",
  async () => {
    const admin = new Pool({ connectionString: process.env.POSTGRES_TEST_URL });
    const schema = "current_token_" + randomUUID().replaceAll("-", "");
    const directory = mkdtempSync(join(tmpdir(), "dz-current-token-"));
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      const url = new URL(process.env.POSTGRES_TEST_URL!);
      url.searchParams.set("options", `-c search_path=${schema}`);
      vi.stubEnv("DATABASE_URL", url.toString());
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("AUTH_DATABASE_PATH", join(directory, "auth.sqlite"));
      vi.stubEnv(
        "INTEGRATIONS_ENCRYPTION_KEY",
        randomBytes(32).toString("hex"),
      );
      const token = await accountLogin(
        "current-token@example.test",
        "fixture-password",
        "Fixture",
      );
      const merchant = (await sessionMerchant(token))!;
      await saveConnection(
        merchant,
        "fixture.myshopify.com",
        "fixture-access-token",
        "read_products",
        new Session({
          id: "offline_fixture.myshopify.com",
          shop: "fixture.myshopify.com",
          state: "",
          isOnline: false,
          accessToken: "fixture-access-token",
          scope: "read_products",
          expires: new Date(Date.now() - 1000),
          refreshToken: "fixture-refresh-token",
          refreshTokenExpires: new Date(Date.now() + 3600000),
        }),
        "gid://shopify/Shop/55",
      );
      const before = await admin.query(
        `SELECT encrypted_token,scope,updated_at FROM ${schema}.shopify_connections`,
      );
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        connectionCredential(merchant, false, false),
      ).rejects.toThrow("Current Shopify token expired");
      const after = await admin.query(
        `SELECT encrypted_token,scope,updated_at FROM ${schema}.shopify_connections`,
      );
      expect(after.rows).toEqual(before.rows);
      expect(fetchMock).not.toHaveBeenCalled();
      // Exercise the real route/authentication/credential reader for two isolated tenants.
      const secondToken = await accountLogin(
        "other-current-token@example.test",
        "fixture-password",
        "Other fixture",
      );
      const secondMerchant = (await sessionMerchant(secondToken))!;
      for (const [owner, shop, access, scope, id] of [
        [
          merchant,
          "fixture.myshopify.com",
          "fixture-access-token",
          "read_products",
          "55",
        ],
        [
          secondMerchant,
          "other-fixture.myshopify.com",
          "other-fixture-token",
          "read_products,write_orders",
          "66",
        ],
      ]) {
        await saveConnection(
          owner,
          shop,
          access,
          scope,
          new Session({
            id: `offline_${shop}`,
            shop,
            state: "",
            isOnline: false,
            accessToken: access,
            scope,
            expires: new Date(Date.now() + 45000),
            refreshToken: "fixture-refresh-token",
            refreshTokenExpires: new Date(Date.now() + 3600000),
          }),
          `gid://shopify/Shop/${id}`,
        );
      }
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("DZ_SHOPIFY_ORDER_SYNC", "0");
      for (const flag of [
        "DZ_BOOTSTRAP_MODE",
        "DZ_LOCAL_DEMO",
        "DZ_DISABLE_EXTERNAL_INTEGRATIONS",
      ])
        vi.stubEnv(flag, "");
      const stable = await admin.query(
        `SELECT merchant_id,encrypted_token,scope,updated_at FROM ${schema}.shopify_connections ORDER BY merchant_id`,
      );
      fetchMock.mockImplementation(
        async (url: string, options: RequestInit) => {
          const second = url.includes("other-fixture.myshopify.com");
          expect(
            new Headers(options.headers).get("x-shopify-access-token"),
          ).toBe(second ? "other-fixture-token" : "fixture-access-token");
          expect(JSON.parse(String(options.body)).query).toContain(
            "currentAppInstallation",
          );
          expect(String(options.body)).not.toContain("mutation");
          return Response.json(
            {
              data: {
                currentAppInstallation: {
                  accessScopes: (second
                    ? ["read_products", "write_orders"]
                    : ["read_products"]
                  ).map((handle) => ({ handle })),
                },
              },
            },
            { headers: { "x-shopify-api-version": "2026-10" } },
          );
        },
      );
      const request = (cookie: string, store = "") =>
        new Request(
          "https://app.example.test/api/integrations/shopify/scopes" +
            (store ? `?store=${store}` : ""),
          { headers: { cookie: `dz_session=${cookie}` } },
        );
      expect((await checkScopes(request(token, secondMerchant))).status).toBe(
        401,
      );
      expect(fetchMock).not.toHaveBeenCalled();
      const first = await checkScopes(request(token));
      expect(first.status).toBe(200);
      expect(await first.json()).toMatchObject({
        readProductsGranted: true,
        writeOrdersGranted: false,
      });
      const second = await checkScopes(request(secondToken));
      expect(second.status).toBe(200);
      expect(await second.json()).toMatchObject({
        readProductsGranted: true,
        writeOrdersGranted: true,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const stableAfter = await admin.query(
        `SELECT merchant_id,encrypted_token,scope,updated_at FROM ${schema}.shopify_connections ORDER BY merchant_id`,
      );
      expect(stableAfter.rows).toEqual(stable.rows);
      expect(process.env.DZ_SHOPIFY_ORDER_SYNC).toBe("0");
    } finally {
      await closeStoragePool();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
