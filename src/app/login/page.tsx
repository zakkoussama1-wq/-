"use client";
import { useLanguage } from "@/components/language-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
export default function Login() {
  const { t } = useLanguage();
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [register, setRegister] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry intentionally repeats the same read after a failure.
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/auth", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setConfigured(d.configured))
      .catch(() => {
        if (!controller.signal.aborted) setError("تعذر تحميل حالة الحساب.");
      });
    return () => controller.abort();
  }, [retry]);
  return (
    <main className="auth-page">
      <div className="auth-brand" dir="ltr">
        DZ Lead Form <span>Pro</span>
      </div>
      <h1 className="text-xl font-bold">
        {t(
          register
            ? "إنشاء حساب متجر"
            : configured === false
              ? "إعداد حساب مالك المتجر المحلي"
              : "تسجيل دخول المالك",
        )}
      </h1>
      <p className="text-sm leading-7">
        {t(
          "أنشئ حساب متجر مستقلًا أو سجّل الدخول. للحساب المحلي القديم اترك البريد فارغًا.",
        )}
      </p>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (configured === null) return;
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: register ? "register" : configured ? "login" : "setup",
                ...(email ? { email } : {}),
                ...(register ? { name } : {}),
                password,
              }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            router.push("/dashboard");
            router.refresh();
          } catch (e) {
            setError(
              e instanceof Error && /[\u0600-\u06ff]/.test(e.message)
                ? e.message
                : "تعذر الدخول.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="email">{t("البريد الإلكتروني")}</label>
        <input
          id="email"
          type="email"
          dir="ltr"
          value={email}
          required={register}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        {register && (
          <label>
            {t("اسم المتجر")}
            <input
              dir="auto"
              value={name}
              required
              minLength={2}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label htmlFor="password">
          {t("كلمة المرور (١٢ حرفًا على الأقل)")}
        </label>
        <input
          id="password"
          type="password"
          minLength={12}
          maxLength={200}
          required
          autoComplete={
            register || !configured ? "new-password" : "current-password"
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button disabled={busy || configured === null}>
          {t(
            busy
              ? "جارٍ التحقق…"
              : register
                ? "إنشاء الحساب"
                : configured
                  ? "دخول"
                  : "إنشاء حساب المالك",
          )}
        </Button>
      </form>
      <Button
        variant="outline"
        type="button"
        disabled={busy}
        onClick={() => {
          setRegister(!register);
          setError("");
        }}
      >
        {t(register ? "لدي حساب بالفعل" : "إنشاء حساب متجر جديد")}
      </Button>
      {configured === null && error && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setRetry((n) => n + 1)}
        >
          {t("إعادة المحاولة")}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {t(error)}
        </p>
      )}
    </main>
  );
}
