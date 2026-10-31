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
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setConfigured(d.configured))
      .catch(() => setError("تعذر تحميل حالة الحساب."));
  }, []);
  return (
    <main className="mx-auto mt-16 max-w-md space-y-5 rounded-2xl bg-white p-6">
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
            setError(e instanceof Error ? e.message : "تعذر الدخول.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="email">{t("البريد الإلكتروني")}</label>
        <input
          id="email"
          type="email"
          value={email}
          required={register}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        {register && (
          <label>
            {t("اسم المتجر")}
            <input
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
          autoComplete={configured ? "current-password" : "new-password"}
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
        onClick={() => setRegister(!register)}
      >
        {t(register ? "لدي حساب بالفعل" : "إنشاء حساب متجر جديد")}
      </Button>
      {error && (
        <p role="alert" className="text-red-700">
          {t(error)}
        </p>
      )}
    </main>
  );
}
