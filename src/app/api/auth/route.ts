import { AuthError, authFailure } from "@/modules/auth/errors";
import { isLocalDemo } from "@/lib/local-demo";
import { NextResponse } from "next/server";
import {
  authenticate,
  authDb,
  logout,
  accountLogin,
  sessionMerchant,
} from "@/modules/auth/store";
import { z } from "zod";
export async function GET(request: Request) {
  if (isLocalDemo())
    return NextResponse.json(
      {
        configured: true,
        merchantId: null,
        merchantName: "متجر التجربة المحلي",
        localDemo: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  try {
    const db = await authDb();
    try {
      const merchant = await sessionMerchant(
        request.headers
          .get("cookie")
          ?.match(/(?:^|; )dz_session=([a-f0-9]+)/)?.[1] ?? "",
      );
      const profile = merchant
        ? await db
            .prepare("SELECT name FROM accounts WHERE merchant_id=?")
            .get(merchant)
        : null;
      return NextResponse.json(
        {
          merchantName: profile
            ? String(profile.name)
            : merchant
              ? "المتجر المحلي"
              : null,
          configured:
            !!(await db.prepare("SELECT 1 FROM owner WHERE id=1").get()) ||
            !!(await db.prepare("SELECT 1 FROM accounts LIMIT 1").get()),
          merchantId: merchant,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } finally {
      await db.close();
    }
  } catch (error) {
    const result = authFailure(error);
    return NextResponse.json(
      { code: result.code, error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export async function POST(request: Request) {
  const u = new URL(request.url);
  if (
    request.headers.get("origin") !==
    `${u.protocol}//${request.headers.get("host") ?? u.host}`
  )
    return NextResponse.json({ error: "مصدر غير مسموح." }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 1024)
      throw new AuthError("AUTH_INPUT_INVALID", 413, "طلب كبير.");
    const raw = JSON.parse(text);
    const data = z
      .object({
        action: z.enum(["login", "setup", "logout", "register"]),
        password: z.string().max(200).optional(),
        email: z.string().max(254).optional(),
        name: z.string().max(100).optional(),
      })
      .strict()
      .parse(raw);
    if (data.action === "logout") {
      const cookie = request.headers
        .get("cookie")
        ?.match(/(?:^|; )dz_session=([a-f0-9]+)/)?.[1];
      if (cookie) await logout(cookie);
      const r = NextResponse.json({ ok: true });
      r.cookies.set("dz_session", "", {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
      return r;
    }
    const token =
      data.action === "register"
        ? await accountLogin(
            data.email ?? "",
            data.password ?? "",
            data.name ?? "",
          )
        : data.email
          ? await accountLogin(data.email, data.password ?? "")
          : await authenticate(data.password ?? "", data.action === "setup");
    const r = NextResponse.json({ ok: true });
    r.cookies.set("dz_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: u.protocol === "https:",
      path: "/",
      maxAge: 28800,
    });
    return r;
  } catch (e) {
    if (e instanceof z.ZodError || e instanceof SyntaxError)
      return NextResponse.json(
        { code: "AUTH_INPUT_INVALID", error: "تحقق من بيانات الدخول." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    const result = authFailure(e);
    return NextResponse.json(
      { code: result.code, error: result.error },
      {
        status: result.status,
        headers: {
          "Cache-Control": "no-store",
          ...(result.status === 429 ? { "Retry-After": "60" } : {}),
        },
      },
    );
  }
}
