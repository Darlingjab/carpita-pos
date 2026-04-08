import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set("pos_demo_user", "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
  return res;
}

