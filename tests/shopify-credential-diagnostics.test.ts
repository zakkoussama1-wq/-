import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomBytes, createCipheriv } from "node:crypto";
import { Session } from "@shopify/shopify-api";
import { diagnoseOfflineCredential } from "../src/modules/integrations/shopify/connections";
import { diagnosticReportSchema } from "../src/modules/orders/shopify/diagnostic-contract";
const merchant = "fixture-merchant",
  shop = "fixture.myshopify.com",
  access = "synthetic-private-access",
  refresh = "synthetic-private-refresh";
let encryptionKey: string;
function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(encryptionKey, "hex"),
    iv,
  );
  cipher.setAAD(Buffer.from(merchant));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((b) => b.toString("base64"))
    .join(".");
}
function session(
  overrides: Partial<ConstructorParameters<typeof Session>[0]> = {},
) {
  return seal(
    JSON.stringify(
      new Session({
        id: `offline_${shop}`,
        shop,
        state: "",
        isOnline: false,
        accessToken: access,
        refreshToken: refresh,
        expires: new Date(Date.now() + 3600000),
        refreshTokenExpires: new Date(Date.now() + 7200000),
        ...overrides,
      }).toPropertyArray(),
    ),
  );
}
beforeEach(() => {
  encryptionKey = randomBytes(32).toString("hex");
  vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", encryptionKey);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected network request");
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("returns only local booleans and fixed reasons with no network or secret exposure", () => {
  const token = seal(access),
    metadata = session();
  const result = diagnoseOfflineCredential(merchant, shop, token, metadata);
  expect(result).toMatchObject({
    offlineSession: true,
    accessTokenPresent: true,
    encryptionKeyFormatValid: true,
    decryptionSucceeded: true,
    shopMatches: true,
    accessTokenExpired: false,
    refreshTokenPresent: true,
    refreshTokenTimeValid: true,
    reasons: ["LOCAL_CREDENTIAL_CHECKS_PASSED"],
  });
  for (const secret of [
    access,
    refresh,
    encryptionKey,
    token,
    metadata,
    shop,
    merchant,
  ])
    expect(JSON.stringify(result)).not.toContain(secret);
  expect(fetch).not.toHaveBeenCalled();
});
it("distinguishes expired access from a still time-valid refresh token without refreshing", () => {
  const result = diagnoseOfflineCredential(
    merchant,
    shop,
    seal(access),
    session({ expires: new Date(Date.now() - 1000) }),
  );
  expect(result).toMatchObject({
    accessTokenExpired: true,
    refreshTokenPresent: true,
    refreshTokenTimeValid: true,
    reasons: ["ACCESS_TOKEN_EXPIRED"],
  });
  expect(fetch).not.toHaveBeenCalled();
});
it.each(["missing", "invalid", "wrong"] as const)(
  "distinguishes %s encryption key from missing credentials",
  (kind) => {
    const token = seal(access),
      metadata = session();
    vi.stubEnv(
      "INTEGRATIONS_ENCRYPTION_KEY",
      kind === "missing"
        ? ""
        : kind === "invalid"
          ? "bad"
          : randomBytes(32).toString("hex"),
    );
    const result = diagnoseOfflineCredential(merchant, shop, token, metadata);
    expect(result.accessTokenPresent).toBeNull();
    expect(result.accessTokenExpired).toBeNull();
    expect(result.encryptionKeyFormatValid).toBe(kind === "wrong");
    expect(result.reasons).toContain(
      kind === "wrong" ? "TOKEN_DECRYPTION_FAILED" : "ENCRYPTION_KEY_INVALID",
    );
  },
);
it("reports missing connection/session independently without assuming expiry", () => {
  const result = diagnoseOfflineCredential(merchant, shop, null, null);
  expect(result).toMatchObject({
    connectionPresent: false,
    sessionMetadataPresent: false,
    decryptionSucceeded: null,
    accessTokenPresent: null,
    accessTokenExpired: null,
    reasons: ["CONNECTION_MISSING", "SESSION_METADATA_MISSING"],
  });
});
it("distinguishes a corrupted session ciphertext from corrupted token ciphertext", () => {
  const badSession = diagnoseOfflineCredential(
    merchant,
    shop,
    seal(access),
    "not-encrypted",
  );
  expect(badSession).toMatchObject({
    connectionDecryptionSucceeded: true,
    sessionDecryptionSucceeded: false,
    accessTokenPresent: null,
    accessTokenExpired: null,
    reasons: ["SESSION_DECRYPTION_FAILED"],
  });
  const badToken = diagnoseOfflineCredential(
    merchant,
    shop,
    "not-encrypted",
    session(),
  );
  expect(badToken).toMatchObject({
    connectionDecryptionSucceeded: false,
    sessionDecryptionSucceeded: true,
    accessTokenPresent: true,
    decryptionSucceeded: false,
    reasons: ["TOKEN_DECRYPTION_FAILED"],
  });
});
it.each([
  "not JSON",
  "{}",
  "[]",
  JSON.stringify([
    ["shop", shop],
    ["isOnline", false],
    ["refreshToken", { invalid: true }],
  ]),
  JSON.stringify([
    ["shop", shop],
    ["isOnline", false],
    ["expires", "bad-date"],
  ]),
])("reports malformed decrypted session metadata %#", (value) => {
  const result = diagnoseOfflineCredential(
    merchant,
    shop,
    seal(access),
    seal(value),
  );
  expect(result.reasons).toContain("SESSION_METADATA_INVALID");
  expect(result.accessTokenExpired).toBeNull();
});
it("distinguishes online session, wrong shop and missing access token", () => {
  expect(
    diagnoseOfflineCredential(
      merchant,
      shop,
      seal(access),
      session({ isOnline: true }),
    ).reasons,
  ).toContain("OFFLINE_SESSION_REQUIRED");
  expect(
    diagnoseOfflineCredential(
      merchant,
      shop,
      seal(access),
      session({ shop: "other.myshopify.com" }),
    ).shopMatches,
  ).toBe(false);
  const missing = diagnoseOfflineCredential(
    merchant,
    shop,
    seal(access),
    session({ accessToken: undefined }),
  );
  expect(missing.accessTokenPresent).toBe(false);
  expect(missing.accessTokenExpired).toBeNull();
  expect(missing.reasons).toContain("ACCESS_TOKEN_MISSING");
});
it.each([undefined, new Date(Date.now() - 10000)])(
  "reports refresh time unavailable/expired without revoking current access %#",
  (expiry) => {
    const result = diagnoseOfflineCredential(
      merchant,
      shop,
      seal(access),
      session({ refreshTokenExpires: expiry }),
    );
    expect(result).toMatchObject({
      accessTokenExpired: false,
      refreshTokenPresent: true,
      refreshTokenTimeValid: false,
    });
    expect(result.reasons).toContain("REFRESH_TOKEN_UNUSABLE");
  },
);
it("rejects raw/unrecognized diagnostic values in UI contracts", () => {
  expect(
    diagnosticReportSchema.safeParse({
      readOnly: false,
      networkChecked: true,
      job: {},
      offline: {},
    }).success,
  ).toBe(false);
});
