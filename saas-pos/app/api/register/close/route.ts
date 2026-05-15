import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { pushRuntimeToCloud } from "@/lib/cloud-sync";
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
  const body = (await request.json().catch(() => ({}))) as { amount?: number };
  const counted = Math.max(0, Number(body.amount) || 0);
  setRegisterClosed();
  const movement = {
    id: `mov_${randomUUID()}`,
    businessId: business.id,
    type: "close" as const,
    amount: counted,
    note: "Cierre de caja",
    createdAt: new Date().toISOString(),
    createdBy: user.id,
  };
  addRegisterMovement(movement);
  const pushed = await pushRuntimeToCloud();
  if (!pushed.ok) {
    return NextResponse.json(
      { error: "cloud_sync_failed", detail: pushed.error },
      { status: 503 },
    );
  }
  return NextResponse.json({ data: movement }, { status: 201 });
}
