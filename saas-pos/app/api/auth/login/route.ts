import { NextResponse } from "next/server";
import { pullRuntimeFromCloud } from "@/lib/cloud-sync";
import { verifyLogin } from "@/lib/user-accounts";

export async function POST(request: Request) {
  await pullRuntimeFromCloud();
  const body = (await request.json()) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const user = verifyLogin(email, password);
  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ data: { email: user.email, role: user.role } });
  res.cookies.set("pos_demo_user", user.email.toLowerCase(), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 12,
  });
  return res;
}
