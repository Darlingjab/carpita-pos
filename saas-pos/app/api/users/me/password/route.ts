import { NextResponse } from "next/server";
import { getSessionUserOrNull } from "@/lib/auth";
import { changeOwnPassword } from "@/lib/user-accounts";

export async function POST(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";
  if (newPassword.length < 4) {
    return NextResponse.json({ error: "password_short" }, { status: 400 });
  }

  const ok = changeOwnPassword(user.id, currentPassword, newPassword);
  if (!ok) {
    return NextResponse.json({ error: "invalid_current" }, { status: 400 });
  }

  return NextResponse.json({ data: { ok: true } });
}
