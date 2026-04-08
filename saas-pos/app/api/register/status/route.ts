import { NextResponse } from "next/server";
import { getRegisterSessionState } from "@/lib/register-session-store";
import { getSessionUserOrNull } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ data: getRegisterSessionState() });
}
