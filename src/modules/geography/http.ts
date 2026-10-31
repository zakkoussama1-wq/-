import { NextResponse } from "next/server";
import { communeParamsSchema, searchParamsSchema } from "./schema";
import { listCommunes, listWilayas } from "./repository";
export function geographyResponse(
  request: Request,
  kind: "wilayas" | "communes",
) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = (
    kind === "communes" ? communeParamsSchema : searchParamsSchema
  ).safeParse(params);
  if (!result.success)
    return NextResponse.json(
      { error: "معايير البحث أو نظام التقسيم الإداري غير صالحة." },
      { status: 400 },
    );
  try {
    const { mode, q } = result.data;
    const items =
      kind === "communes"
        ? listCommunes(
            mode,
            communeParamsSchema.parse(result.data).wilayaCode,
            q,
          )
        : listWilayas(mode, q);
    return NextResponse.json({
      items,
      mode,
      verification:
        mode === "legacy58" ? "source-reviewed" : "secondary-reference-only",
    });
  } catch (error) {
    if (error instanceof RangeError)
      return NextResponse.json(
        { error: "الولاية لا تنتمي إلى النظام الإداري المحدد." },
        { status: 400 },
      );
    console.error("Geography database unavailable");
    return NextResponse.json(
      {
        error:
          "تعذر تحميل البيانات الجغرافية. أعد المحاولة، أو تواصل مع مسؤول المتجر.",
      },
      { status: 503 },
    );
  }
}
