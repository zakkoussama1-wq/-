import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { embeddedFetch, merchantFetch } from "../src/lib/merchant-fetch";
let idToken: ReturnType<typeof vi.fn>,
  transport: ReturnType<typeof vi.fn>,
  dispatch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  idToken = vi
    .fn()
    .mockResolvedValueOnce("synthetic-first-session")
    .mockResolvedValue("synthetic-next-session");
  transport = vi.fn(async () => Response.json({ ok: true }));
  dispatch = vi.fn();
  vi.stubGlobal("window", {
    location: {
      origin: "https://app.example.test",
      pathname: "/shopify/builder",
    },
    shopify: { idToken },
    dispatchEvent: dispatch,
  });
  vi.stubGlobal("fetch", transport);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("requests a fresh App Bridge idToken for every same-origin call without cookies", async () => {
  await embeddedFetch("/api/embedded/session");
  await embeddedFetch("/api/embedded/form-config");
  expect(idToken).toHaveBeenCalledTimes(2);
  expect(
    new Headers(transport.mock.calls[0][1].headers).get("authorization"),
  ).toBe("Bearer synthetic-first-session");
  expect(
    new Headers(transport.mock.calls[1][1].headers).get("authorization"),
  ).toBe("Bearer synthetic-next-session");
  expect(transport.mock.calls[0][1]).toMatchObject({
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
  });
});
it("rejects external URLs and old merchant endpoints before obtaining any token", async () => {
  await expect(
    embeddedFetch("https://attacker.example/api/embedded/session"),
  ).rejects.toThrow();
  await expect(embeddedFetch("/api/orders")).rejects.toThrow();
  expect(idToken).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
});
it("maps only shipping/geography endpoints while inside the embedded app", async () => {
  await merchantFetch("/api/shipping?mode=legacy58");
  expect(String(transport.mock.calls[0][0])).toBe(
    "https://app.example.test/api/embedded/shipping?mode=legacy58",
  );
  await expect(merchantFetch("/api/orders")).rejects.toThrow();
});
it("preserves the standalone transport without App Bridge or credential changes", async () => {
  window.location.pathname = "/dashboard";
  const init = { method: "GET" };
  await merchantFetch("/api/shipping", init);
  expect(transport).toHaveBeenCalledWith("/api/shipping", init);
  expect(idToken).not.toHaveBeenCalled();
});
it("surfaces an expired session without refreshing OAuth or persisting the token", async () => {
  transport.mockResolvedValue(new Response(null, { status: 401 }));
  await embeddedFetch("/api/embedded/session");
  expect(dispatch.mock.calls[0][0].type).toBe("dz:embedded-session-expired");
  expect(transport).toHaveBeenCalledTimes(1);
});

it("redacts App Bridge exceptions before a shipping component can display them", async () => {
  idToken
    .mockReset()
    .mockRejectedValue(new Error("private-fixture-token-secret"));
  await expect(embeddedFetch("/api/embedded/session")).rejects.toThrow(
    "تعذر التحقق من جلسة Shopify",
  );
  try {
    await embeddedFetch("/api/embedded/session");
  } catch (error) {
    expect(String(error)).not.toContain("private-fixture-token-secret");
  }
  expect(transport).not.toHaveBeenCalled();
});
