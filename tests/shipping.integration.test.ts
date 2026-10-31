import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  changeShipping,
  getShippingState,
  ConflictError,
} from "../src/modules/shipping/repository";
import { quoteShipping } from "../src/modules/shipping/service";
import {
  writeShipping,
  readShipping,
  readQuote,
} from "../src/modules/shipping/http";
import type { ShippingRule } from "../src/modules/shipping/schema";
const directory = mkdtempSync(join(tmpdir(), "dz-shipping-test-"));
const previous = process.env.SHIPPING_DATABASE_PATH;
const previousMerchant = process.env.LOCAL_MERCHANT_ID;
beforeAll(() => {
  process.env.SHIPPING_DATABASE_PATH = join(directory, "shipping.sqlite");
  process.env.LOCAL_MERCHANT_ID = "http-merchant";
});
afterAll(() => {
  if (previous === undefined) delete process.env.SHIPPING_DATABASE_PATH;
  else process.env.SHIPPING_DATABASE_PATH = previous;
  if (previousMerchant === undefined) delete process.env.LOCAL_MERCHANT_ID;
  else process.env.LOCAL_MERCHANT_ID = previousMerchant;
  rmSync(directory, { recursive: true, force: true });
});
const rule: ShippingRule = {
  available: true,
  home: { enabled: true, price: 500 },
  office: { enabled: false, price: null },
  eta: "١–٣ أيام",
};
const input = {
  mode: "legacy58" as const,
  wilayaCode: "28",
  communeId: "dz:commune:1006",
  method: "home" as const,
};
function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/shipping", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("shipping persistence, transactions and tenant scoping", () => {
  it("starts unset and keeps independent merchants and administrative modes", async () => {
    expect((await getShippingState("merchant-a", "legacy58")).entries).toEqual(
      [],
    );
    await changeShipping("merchant-a", "legacy58", 0, {
      entries: [{ scope: "default", target: "*", rule }],
    });
    expect((await quoteShipping("merchant-a", input)).amount).toBe(500);
    expect((await quoteShipping("merchant-b", input)).available).toBe(false);
    expect((await getShippingState("merchant-a", "updated69")).entries).toEqual(
      [],
    );
  });
  it("persists after reopening and preserves rates across reads", async () => {
    expect(
      (await getShippingState("merchant-a", "legacy58")).entries[0].rule.home
        .price,
    ).toBe(500);
    expect((await getShippingState("merchant-a", "legacy58")).revision).toBe(1);
  });
  it("rejects invalid commune parent, mode and caller price", async () => {
    await expect(
      quoteShipping("merchant-a", { ...input, wilayaCode: "16" }),
    ).rejects.toThrow(RangeError);
    await expect(
      quoteShipping("merchant-a", { ...input, mode: "updated69" }),
    ).rejects.toThrow(RangeError);
    await expect(
      quoteShipping("merchant-a", {
        ...input,
        amount: 1,
      } as typeof input),
    ).rejects.toThrow();
    await expect(
      changeShipping("merchant-a", "legacy58", 1, {
        entries: [{ scope: "wilaya", target: "68", rule }],
      }),
    ).rejects.toThrow(RangeError);
  });
  it("writes a bulk operation atomically and rejects stale revisions", async () => {
    const s = await changeShipping("bulk", "legacy58", 0, {
      entries: [
        { scope: "wilaya", target: "16", rule },
        { scope: "wilaya", target: "28", rule },
      ],
    });
    expect(s.entries).toHaveLength(2);
    await expect(
      changeShipping("bulk", "legacy58", 0, {
        reset: [{ scope: "wilaya", target: "16" }],
      }),
    ).rejects.toThrow(ConflictError);
    expect((await getShippingState("bulk", "legacy58")).entries).toHaveLength(
      2,
    );
  });
  it("rolls back the first row when a later rule is invalid", async () => {
    await expect(
      changeShipping("rollback", "legacy58", 0, {
        entries: [
          { scope: "wilaya", target: "16", rule },
          {
            scope: "wilaya",
            target: "28",
            rule: { ...rule, home: { enabled: true, price: -1 } },
          },
        ],
      }),
    ).rejects.toThrow();
    expect(await getShippingState("rollback", "legacy58")).toMatchObject({
      revision: 0,
      entries: [],
    });
  });
  it("reset deletes only the selected merchant's rule and restores fallback", async () => {
    await changeShipping("merchant-a", "legacy58", 1, {
      entries: [
        {
          scope: "commune",
          target: input.communeId,
          rule: { ...rule, home: { enabled: true, price: 0 } },
        },
      ],
    });
    expect((await quoteShipping("merchant-a", input)).amount).toBe(0);
    await changeShipping("merchant-a", "legacy58", 2, {
      reset: [{ scope: "commune", target: input.communeId }],
    });
    expect((await quoteShipping("merchant-a", input)).amount).toBe(500);
    expect((await getShippingState("bulk", "legacy58")).entries).toHaveLength(
      2,
    );
  });
});
describe("shipping HTTP boundaries", () => {
  it("guards writes against other origins and client tenant selection", async () => {
    expect(
      (
        await writeShipping(
          request(
            {
              action: "settings",
              mode: "legacy58",
              revision: 0,
              genericOffice: true,
            },
            "http://evil.invalid",
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await writeShipping(
          request({
            action: "settings",
            mode: "legacy58",
            revision: 0,
            genericOffice: true,
            merchantId: "merchant-a",
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("saves and returns 409 for a stale change", async () => {
    const body = {
      action: "save",
      mode: "legacy58",
      revision: 0,
      entries: [{ scope: "default", target: "*", rule }],
    };
    expect((await writeShipping(request(body))).status).toBe(200);
    expect((await writeShipping(request(body))).status).toBe(409);
  });
  it("exposes only the server tenant and validates quote location and final-price injection", async () => {
    const read = await (
      await readShipping(
        new Request("http://localhost/api/shipping?mode=legacy58"),
      )
    ).json();
    expect(read.entries).toHaveLength(1);
    expect(read.revision).toBe(1);
    expect(
      (
        await readShipping(
          new Request("http://localhost/api/shipping?merchantId=merchant-a"),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await readQuote(
          new Request(
            "http://localhost/api/shipping/quote?mode=legacy58&wilayaCode=28&communeId=dz:commune:1006&method=home&amount=1",
          ),
        )
      ).status,
    ).toBe(400);
    const quote = await readQuote(
      new Request(
        "http://localhost/api/shipping/quote?mode=legacy58&wilayaCode=28&communeId=dz:commune:1006&method=home",
      ),
    );
    expect((await quote.json()).amount).toBe(500);
  });
  it("rejects malformed CSV without changing persisted rates", async () => {
    const r = await writeShipping(
      request({
        action: "import",
        mode: "legacy58",
        revision: 1,
        csv: "bad\nwrong",
      }),
    );
    expect(r.status).toBe(400);
    expect((await getShippingState("http-merchant", "legacy58")).revision).toBe(
      1,
    );
  });
});
describe("office delivery and storage failure", () => {
  it("requires explicit generic office opt-in independently of configured office price", async () => {
    let state = await getShippingState("http-merchant", "legacy58");
    state = await changeShipping("http-merchant", "legacy58", state.revision, {
      entries: [
        {
          scope: "default",
          target: "*",
          rule: { ...rule, office: { enabled: true, price: 275.5 } },
        },
      ],
    });
    expect(
      (await quoteShipping("http-merchant", { ...input, method: "office" }))
        .available,
    ).toBe(false);
    const response = await writeShipping(
      request({
        action: "settings",
        mode: "legacy58",
        revision: state.revision,
        genericOffice: true,
      }),
    );
    expect(response.status).toBe(200);
    expect(
      await quoteShipping("http-merchant", { ...input, method: "office" }),
    ).toMatchObject({ available: true, amount: 275.5 });
  });
  it("returns 503 when the shipping store cannot open, without inventing prices", async () => {
    const saved = process.env.SHIPPING_DATABASE_PATH;
    process.env.SHIPPING_DATABASE_PATH = directory;
    try {
      const response = await readShipping(
        new Request("http://localhost/api/shipping"),
      );
      expect(response.status).toBe(503);
      expect((await response.json()).error).toContain("تعذر");
    } finally {
      process.env.SHIPPING_DATABASE_PATH = saved;
    }
  });
});
