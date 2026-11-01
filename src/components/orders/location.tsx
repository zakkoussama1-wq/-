"use client";
import { useEffect, useState } from "react";
import { geographyResponseSchema } from "@/modules/geography/schema";
import type { StoredOrder } from "@/modules/orders/repository";
import { useLanguage } from "../language-provider";
export function OrderLocation({
  customer,
}: {
  customer: StoredOrder["customer"];
}) {
  const { t, language } = useLanguage();
  const [names, setNames] = useState<{
    wilaya: string;
    commune: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const { mode, wilayaCode, communeId } = customer;
  useEffect(() => {
    const controller = new AbortController();
    setNames(null);
    setFailed(false);
    Promise.all([
      fetch(`/api/geography/wilayas?mode=${mode}`, {
        signal: controller.signal,
      }),
      fetch(`/api/geography/communes?mode=${mode}&wilayaCode=${wilayaCode}`, {
        signal: controller.signal,
      }),
    ])
      .then(async (responses) => {
        if (responses.some((r) => !r.ok)) throw new Error();
        const [wilayas, communes] = await Promise.all(
          responses.map(async (r) =>
            geographyResponseSchema.parse(await r.json()),
          ),
        );
        const wilaya = wilayas.items.find((item) => item.code === wilayaCode);
        const commune = communes.items.find((item) => item.id === communeId);
        if (!wilaya || !commune) throw new Error();
        if (!controller.signal.aborted)
          setNames({
            wilaya: language === "ar" ? wilaya.nameAr : wilaya.nameLatin,
            commune: language === "ar" ? commune.nameAr : commune.nameLatin,
          });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [mode, wilayaCode, communeId, language]);
  return (
    <div className="data-location">
      <dt>{t("الولاية والبلدية")}</dt>
      <dd>
        {names ? (
          `${names.wilaya} · ${names.commune}`
        ) : failed ? (
          <>
            <bdi>
              {wilayaCode} · {communeId}
            </bdi>
            <span>{t("تعذر تحميل أسماء المناطق.")}</span>
          </>
        ) : (
          t("جارٍ تحميل المناطق…")
        )}
      </dd>
    </div>
  );
}
