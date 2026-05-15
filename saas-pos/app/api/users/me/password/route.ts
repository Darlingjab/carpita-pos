import { NextResponse } from "next/server";
import { pushRuntimeToCloud } from "@/lib/cloud-sync";
import { getSessionUserOrNull } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limiter";
import { MIN_PASSWORD_LENGTH, changeOwnPassword } from "@/lib/user-accounts";

export async function POST(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit por IP: 5 intentos por 5 minutos
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (isRateLimited(`pwd:${ip}`, 5, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "password_short" }, { status: 400 });
  }

  const ok = changeOwnPassword(user.id, currentPassword, newPassword);
  if (!ok) {
    return NextResponse.json({ error: "invalid_current" }, { status: 400 });
  }

  const pushed = await pushRuntimeToCloud();
  if (!pushed.ok) {
    return NextResponse.json(
      { error: "cloud_sync_failed", detail: pushed.error },
      { status: 503 },
    );
  }
  return NextResponse.json({ data: { ok: true } });
}
