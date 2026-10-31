import { afterAll, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  accountLogin,
  sessionMerchant,
  logout,
} from "../src/modules/auth/store";
import { localMerchantId } from "../src/modules/merchants/local-context";
import {
  changeShipping,
  getShippingState,
} from "../src/modules/shipping/repository";
const dir = mkdtempSync(join(tmpdir(), "dz-tenants-"));
process.env.AUTH_DATABASE_PATH = join(dir, "auth.sqlite");
process.env.SHIPPING_DATABASE_PATH = join(dir, "shipping.sqlite");
afterAll(() => rmSync(dir, { recursive: true, force: true }));
it("isolates accounts and derives private tenant from the verified session, never store queries", async () => {
  const a = await accountLogin(
    "a@example.test",
    "test-password-for-a",
    "المتجر الأول",
  );
  const b = await accountLogin(
    "b@example.test",
    "test-password-for-b",
    "المتجر الثاني",
  );
  const aid = (await sessionMerchant(a))!;
  const bid = (await sessionMerchant(b))!;
  expect(aid).not.toBe(bid);
  const req = new Request(`http://localhost/api/orders?store=${bid}`, {
    headers: { cookie: `dz_session=${a}` },
  });
  expect(await localMerchantId(req)).toBe(aid);
  expect(await localMerchantId(req, true)).toBe(bid);
  await changeShipping(aid, "legacy58", 0, {
    entries: [
      {
        scope: "default",
        target: "*",
        rule: {
          available: true,
          home: { enabled: true, price: 450 },
          office: { enabled: false, price: null },
          eta: "",
        },
      },
    ],
  });
  expect((await getShippingState(bid, "legacy58")).entries).toEqual([]);
  await expect(
    accountLogin("a@example.test", "wrong-password-123"),
  ).rejects.toThrow();
  await expect(
    accountLogin("a@example.test", "test-password-for-a", "duplicate"),
  ).rejects.toThrow();
  await logout(a);
  expect(await sessionMerchant(a)).toBeNull();
  expect(await sessionMerchant(b)).toBe(bid);
});
