"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { messages } from "@/lib/messages";
export type Language = "ar" | "fr" | "en";
const LanguageContext = createContext({
  language: "ar" as Language,
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
    <LanguageContext.Provider value={{ language, t }}>
      <div className="app-toolbar">
        <label htmlFor="app-language" className="sr-only sm:not-sr-only !mb-0">
          {language === "ar"
            ? "اللغة"
            : language === "fr"
              ? "Langue"
              : "Language"}
        </label>
        <select
          id="app-language"
          aria-label="Language / اللغة / Langue"
          className="!w-auto"
          value={language}
          onChange={(e) => {
            const value = e.target.value as Language;
            document.documentElement.lang = value;
            document.documentElement.dir = value === "ar" ? "rtl" : "ltr";
            localStorage.setItem("dz-language", value);
            setLanguage(value);
          }}
        >
          <option value="ar">العربية</option>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
        <a className="font-bold text-emerald-800 underline" href="/form">
          {t("فتح نموذج الطلب")}
        </a>
        <a className="font-bold text-emerald-800 underline" href="/dashboard">
          {t("فتح لوحة التحكم")}
        </a>
      </div>

      {children}
    </LanguageContext.Provider>
  );
}
