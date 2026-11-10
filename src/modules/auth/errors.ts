/** Public auth failures are fixed messages/codes; never return SQL, credentials,
 * request bodies or arbitrary exception messages. */
export class AuthError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function isAccountConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; errcode?: unknown };
  return (
    e.code === "23505" ||
    e.code === "SQLITE_CONSTRAINT_UNIQUE" ||
    e.code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
    e.errcode === 2067 ||
    e.errcode === 1555
  );
}
const known: Record<string, [string, number]> = {
  "تحقق من البريد وكلمة المرور (١٢ حرفًا على الأقل).": [
    "AUTH_INPUT_INVALID",
    400,
  ],
  "كلمة المرور يجب أن تتكون من ١٢–٢٠٠ حرف.": ["AUTH_INPUT_INVALID", 400],
  "أدخل اسم متجر صحيحًا.": ["AUTH_INPUT_INVALID", 400],
  "بيانات الدخول غير صحيحة.": ["AUTH_CREDENTIALS_INVALID", 401],
  "محاولات كثيرة. حاول لاحقًا.": ["AUTH_RATE_LIMITED", 429],
  "محاولات كثيرة. حاول بعد دقيقة.": ["AUTH_RATE_LIMITED", 429],
  "تم إعداد حساب المالك مسبقًا.": ["AUTH_SETUP_UNAVAILABLE", 409],
};
export function authFailure(error: unknown) {
  if (error instanceof AuthError)
    return { code: error.code, status: error.status, error: error.message };
  const entry =
    error instanceof Error && Object.hasOwn(known, error.message)
      ? known[error.message]
      : undefined;
  if (entry)
    return {
      code: entry[0],
      status: entry[1],
      error: (error as Error).message,
    };
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  const category =
    code === "42501"
      ? "database_permission"
      : ["42703", "42P01"].includes(String(code))
        ? "database_schema"
        : "storage_or_service";
  console.error(
    JSON.stringify({ event: "authentication_unavailable", category }),
  );
  return {
    code: "AUTH_UNAVAILABLE",
    status: 503,
    error: "تعذر الوصول إلى خدمة الحسابات. أعد المحاولة لاحقًا.",
  };
}
