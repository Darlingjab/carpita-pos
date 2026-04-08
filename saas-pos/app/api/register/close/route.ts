import { NextResponse } from "next/server";
import { setRegisterClosed } from "@/lib/register-session-store";
import { addRegisterMovement } from "@/lib/store";
import { getCurrentBusinessMock, getSessionUserOrNull, hasPermission } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "register.close")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const business = getCurrentBusinessMock();
  const body = (await request.json()) as { amount: number };
  setRegisterClosed();
  const movement = {
    id: `mov_${Date.now()}`,
    businessId: business.id,
    type: "close" as const,
    amount: body.amount,
    note: "Cierre de caja",
    createdAt: new Date().toISOString(),
    createdBy: user.id,
  };
  addRegisterMovement(movement);
  return NextResponse.json({ data: movement }, { status: 201 });
}
