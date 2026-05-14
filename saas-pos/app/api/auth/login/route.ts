import { NextResponse } from "next/server";
import { pullRuntimeFromCloud } from "@/lib/cloud-sync";
import { verifyLogin } from "@/lib/user-accounts";
import { signSession } from "@/lib/session";
import { COOKIE_NAME } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limiter";

const SESSION_MAX_AGE = 60 * 60 * 12; // 12 horas

/** Máximo 10 intentos por IP cada 15 minutos */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  // Rate limiting por IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: "too_many_requests", message: "Demasiados intentos. Intenta en 15 minutos." },
      { status: 429 },
    );
  }

  await pullRuntimeFromCloud();
  const body = (await request.json()) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const user = verifyLogin(email, password);
  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = signSession(user.id, SESSION_MAX_AGE);
  const res = NextResponse.json({ data: { email: user.email, role: user.role } });
  res.cookies.set(COOKIE_NAME, token, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
