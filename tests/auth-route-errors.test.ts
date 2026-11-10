import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  owner: vi.fn(),
  db: vi.fn(),
  merchant: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("../src/modules/auth/store", () => ({
  accountLogin: mocks.account,
  authenticate: mocks.owner,
  authDb: mocks.db,
  sessionMerchant: mocks.merchant,
  logout: mocks.logout,
}));
import { GET, POST } from "../src/app/api/auth/route";
import { AuthError, isAccountConflict } from "../src/modules/auth/errors";
const req = (body: unknown, origin = "https://app.example.test") =>
  new Request("https://app.example.test/api/auth", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.stubEnv("DZ_LOCAL_DEMO", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.account.mockReset().mockResolvedValue("a".repeat(64));
  mocks.owner.mockReset();
  mocks.db.mockReset();
  mocks.merchant.mockReset();
  mocks.logout.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("returns a distinct invalid-credentials status without changing authentication", async () => {
  mocks.account.mockRejectedValue(new Error("بيانات الدخول غير صحيحة."));
  const r = await POST(
    req({
      action: "login",
      email: "fixture@example.test",
      password: "wrong-fixture-password",
    }),
  );
  expect(r.status).toBe(401);
  expect(await r.json()).toMatchObject({ code: "AUTH_CREDENTIALS_INVALID" });
  expect(r.headers.get("set-cookie")).toBeNull();
});
it("reports registration conflicts separately from storage failures", async () => {
  mocks.account.mockRejectedValue(
    new AuthError(
      "AUTH_REGISTRATION_REJECTED",
      409,
      "تعذر إنشاء الحساب بهذا البريد. إذا كان لديك حساب بالفعل، استخدم تسجيل الدخول.",
    ),
  );
  const r = await POST(
    req({
      action: "register",
      email: "fixture@example.test",
      password: "fixture-password",
      name: "Fixture",
    }),
  );
  expect(r.status).toBe(409);
  expect(await r.json()).toMatchObject({ code: "AUTH_REGISTRATION_REJECTED" });
});
it("never returns or logs raw SQL or connection secrets on POST failures", async () => {
  mocks.account.mockRejectedValue(
    Object.assign(
      new Error(
        "private-fixture-password private-fixture-token SELECT account",
      ),
      { code: "42501" },
    ),
  );
  const r = await POST(
    req({
      action: "login",
      email: "fixture@example.test",
      password: "private-fixture-password",
    }),
  );
  expect(r.status).toBe(503);
  expect(await r.json()).toEqual({
    code: "AUTH_UNAVAILABLE",
    error: "تعذر الوصول إلى خدمة الحسابات. أعد المحاولة لاحقًا.",
  });
  const logs = JSON.stringify(vi.mocked(console.error).mock.calls);
  expect(logs).toContain("database_permission");
  expect(logs).not.toMatch(/private-fixture|SELECT account/);
});
it("returns safe JSON when account-status storage cannot be opened", async () => {
  mocks.db.mockRejectedValue(new Error("private-connection-string"));
  const r = await GET(new Request("https://app.example.test/api/auth"));
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("private-connection-string");
});
it("preserves the strict secure HttpOnly session cookie on successful login", async () => {
  const r = await POST(
    req({
      action: "login",
      email: "fixture@example.test",
      password: "fixture-password",
    }),
  );
  expect(r.status).toBe(200);
  const cookie = r.headers.get("set-cookie")!;
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Secure");
  expect(cookie).toContain("SameSite=strict");
  expect(await r.json()).toEqual({ ok: true });
});
it("keeps CSRF protection and does not authenticate a cross-origin request", async () => {
  expect(
    (
      await POST(
        req(
          { action: "login", password: "fixture-password" },
          "https://attacker.example",
        ),
      )
    ).status,
  ).toBe(403);
  expect(mocks.account).not.toHaveBeenCalled();
  expect(mocks.owner).not.toHaveBeenCalled();
});
it("does not serialize JSON parser excerpts or request-body secrets", async () => {
  const r = await POST(
    new Request("https://app.example.test/api/auth", {
      method: "POST",
      headers: {
        origin: "https://app.example.test",
        "content-type": "application/json",
      },
      body: '{"password":"private-body-secret",',
    }),
  );
  expect(r.status).toBe(400);
  const text = await r.text();
  expect(text).toContain("AUTH_INPUT_INVALID");
  expect(text).not.toContain("private-body-secret");
});
it("returns the existing retry policy for rate-limited authentication", async () => {
  mocks.account.mockRejectedValue(new Error("محاولات كثيرة. حاول لاحقًا."));
  const r = await POST(
    req({
      action: "login",
      email: "fixture@example.test",
      password: "fixture-password",
    }),
  );
  expect(r.status).toBe(429);
  expect(r.headers.get("retry-after")).toBe("60");
});
it("recognizes only actual uniqueness failures as account conflicts", () => {
  expect(isAccountConflict({ code: "23505" })).toBe(true);
  expect(isAccountConflict({ errcode: 2067 })).toBe(true);
  for (const code of ["42501", "42703", "23514", "ECONNREFUSED"])
    expect(isAccountConflict({ code })).toBe(false);
});
