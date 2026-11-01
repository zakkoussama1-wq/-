"use client";
import { Button } from "./button";
import { useLanguage } from "../language-provider";
export function TablePagination({
  page,
  size,
  total,
  onPage,
  onSize,
}: {
  page: number;
  size: number;
  total: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const { t } = useLanguage();
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <footer className="data-pagination">
      <span>
        {t("النتائج:")}{" "}
        <bdi dir="ltr">
          {total ? (page - 1) * size + 1 : 0}–{Math.min(page * size, total)} /{" "}
          {total}
        </bdi>
      </span>
      <div>
        <label>
          {t("صفوف لكل صفحة")}
          <select value={size} onChange={(e) => onSize(Number(e.target.value))}>
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          {t("السابق")}
        </Button>
        <bdi dir="ltr">
          {page} / {pages}
        </bdi>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          {t("التالي")}
        </Button>
      </div>
    </footer>
  );
}
