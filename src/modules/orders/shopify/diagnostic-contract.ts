import { z } from "zod";
export const credentialReasons = [
  "CONNECTION_MISSING",
  "ENCRYPTION_KEY_INVALID",
  "SESSION_METADATA_MISSING",
  "CONNECTION_TOKEN_MISSING",
  "TOKEN_DECRYPTION_FAILED",
  "SESSION_DECRYPTION_FAILED",
  "SESSION_METADATA_INVALID",
  "OFFLINE_SESSION_REQUIRED",
  "ACCESS_TOKEN_MISSING",
  "SHOP_BINDING_MISMATCH",
  "ACCESS_TOKEN_EXPIRED",
  "REFRESH_TOKEN_UNUSABLE",
  "LOCAL_CREDENTIAL_CHECKS_PASSED",
] as const;
export const jobErrorCodes = [
  "",
  "UNKNOWN_ERROR_CODE",
  "LOCAL_ORDER_MISSING",
  "LOCAL_ORDER_CANCELLED",
  "LOCAL_CANCELLED_REMOTE_EXISTS",
  "NOT_SHOPIFY_ORDER",
  "OFFLINE_AUTH_REQUIRED",
  "WRITE_ORDERS_REQUIRED",
  "SHOP_BINDING_MISMATCH",
  "SHOP_OR_CURRENCY_MISMATCH",
  "TAX_BREAKDOWN_REQUIRED",
  "INVALID_MONEY",
  "INVALID_LOCATION",
  "INVALID_ORDER_SNAPSHOT",
  "INVENTORY_POLICY_UNSUPPORTED",
  "SCHEMA_UNSUPPORTED",
  "SCHEMA_REQUIRED_FIELD",
  "SCHEMA_INVALID_LIST",
  "SCHEMA_INVALID_SCALAR",
  "SCHEMA_INVALID_ENUM",
  "SCHEMA_INVALID_INPUT",
  "SCHEMA_UNSUPPORTED_FIELD",
  "SCHEMA_ORDER_CREATE_MISSING",
  "SCHEMA_REQUIRED_ARGUMENT",
  "THROTTLED",
  "SHOPIFY_ACCESS_DENIED",
  "PROTECTED_DATA_OR_SCOPE_DENIED",
  "SHOPIFY_HTTP_FAILURE",
  "API_VERSION_MISMATCH",
  "SHOPIFY_GRAPHQL_REJECTED",
  "SHOPIFY_RESPONSE_INVALID",
  "RECONCILIATION_INVALID",
  "MULTIPLE_REMOTE_MATCHES",
  "REMOTE_ID_INVALID",
  "REMOTE_REFERENCE_MISMATCH",
  "REMOTE_ORDER_MISMATCH",
  "PAYLOAD_CORRUPT",
  "READ_WINDOW_EXCEEDED",
  "AWAITING_REMOTE_RECONCILIATION",
  "SYNC_DISABLED",
  "TRIAL_SCOPE_DENIED",
  "SHOPIFY_VALIDATION",
  "CREATE_RESULT_UNKNOWN",
  "TRANSPORT_OR_STORAGE_FAILURE",
] as const;
export function safeJobError(value: unknown): (typeof jobErrorCodes)[number] {
  return typeof value === "string" &&
    (jobErrorCodes as readonly string[]).includes(value)
    ? (value as (typeof jobErrorCodes)[number])
    : "UNKNOWN_ERROR_CODE";
}
const nullableBoolean = z.boolean().nullable();
export const offlineDiagnosticSchema = z.object({
  connectionPresent: z.boolean(),
  sessionMetadataPresent: z.boolean(),
  encryptionKeyFormatValid: z.boolean(),
  connectionTokenPresent: nullableBoolean,
  accessTokenPresent: nullableBoolean,
  offlineSession: nullableBoolean,
  connectionDecryptionSucceeded: nullableBoolean,
  sessionDecryptionSucceeded: nullableBoolean,
  decryptionSucceeded: nullableBoolean,
  shopMatches: nullableBoolean,
  accessTokenExpired: nullableBoolean,
  refreshTokenPresent: nullableBoolean,
  refreshTokenTimeValid: nullableBoolean,
  reasons: z.array(z.enum(credentialReasons)),
});
export type OfflineDiagnostic = z.infer<typeof offlineDiagnosticSchema>;
export const diagnosticReportSchema = z.object({
  readOnly: z.literal(true),
  networkChecked: z.literal(false),
  job: z.object({
    exists: z.boolean(),
    state: z
      .enum([
        "queued",
        "processing",
        "retryable",
        "reauthorization",
        "uncertain",
        "review",
        "synced",
        "cancelled",
        "unknown",
      ])
      .nullable(),
    dispatched: z.union([z.literal(0), z.literal(1), z.null()]),
    attempts: z.number().int().min(0).nullable(),
    errorCode: z.enum(jobErrorCodes),
    hasShopifyOrderId: z.boolean(),
  }),
  offline: offlineDiagnosticSchema,
});
export type DiagnosticReport = z.infer<typeof diagnosticReportSchema>;
