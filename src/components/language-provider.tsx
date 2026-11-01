"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { messages } from "@/lib/messages";
import { usePathname } from "next/navigation";
export type Language = "ar" | "fr" | "en";
const LanguageContext = createContext({
  language: "ar" as Language,
  changeLanguage: (value: Language) => {
    void value;
  },
  t: <T,>(value: T): T => value,
});
export function translate<T>(value: T, language: Language): T {
  if (language === "ar" || typeof value !== "string") return value;
  const key = value.replace(/\s+/g, " ").trim();
  const translated = messages[key]?.[language];
  return (translated ?? value) as T;
}
export function useLanguage() {
  return useContext(LanguageContext);
}
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("ar");
  const pathname = usePathname();
  const changeLanguage = (value: Language) => {
    document.documentElement.lang = value;
    document.documentElement.dir = value === "ar" ? "rtl" : "ltr";
    localStorage.setItem("dz-language", value);
    setLanguage(value);
  };

  useEffect(() => {
    const value = localStorage.getItem("dz-language");
    if (value === "fr" || value === "en") {
      document.documentElement.lang = value;
      document.documentElement.dir = "ltr";
      setLanguage(value);
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.title =
      language === "ar"
        ? "DZ Lead Form Pro | تجربة محلية"
        : language === "fr"
          ? "DZ Lead Form Pro | Démonstration locale"
          : "DZ Lead Form Pro | Local demo";
  }, [language]);
  const t = useCallback(
    <T,>(value: T): T => translate(value, language),
    [language],
  );
  return (
    <LanguageContext.Provider value={{ language, t, changeLanguage }}>
      {pathname !== "/dashboard" && (
        <div className="app-toolbar">
          <LanguageSwitcher />
          <a className="font-bold text-emerald-800 underline" href="/form">
            {t("فتح نموذج الطلب")}
          </a>
          <a className="font-bold text-emerald-800 underline" href="/dashboard">
            {t("فتح لوحة التحكم")}
          </a>
        </div>
      )}

      {children}
    </LanguageContext.Provider>
  );
}

export function LanguageSwitcher() {
  const { language, changeLanguage } = useLanguage();
  return (
    <select
      id="app-language"
      aria-label="Language / اللغة / Langue"
      className="language-switcher !w-auto"
      value={language}
      onChange={(e) => changeLanguage(e.target.value as Language)}
    >
      <option value="ar">العربية</option>
      <option value="fr">Français</option>
      <option value="en">English</option>
    </select>
  );
}
