import { NextResponse } from "next/server";
import { pushRuntimeToCloud } from "@/lib/cloud-sync";
import { getCurrentBusinessMock, getSessionUserOrNull, hasPermission } from "@/lib/auth";
import { addRegisterMovement, getRegisterMovements } from "@/lib/store";

export async function GET() {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "register.movements") && !hasPermission(user, "reports.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ data: getRegisterMovements() });
}

export async function POST(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "register.movements")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const business = getCurrentBusinessMock();
  const body = (await request.json()) as { type?: string; amount?: number; note?: string };

  const type = body.type === "in" ? "in" : "out";
  const amount = Math.abs(Number(body.amount) || 0);
  if (!amount) return NextResponse.json({ error: "amount_required" }, { status: 400 });

  const movement = {
    id: `mov_${Date.now()}`,
    businessId: business.id,
    type: type as "in" | "out",
    amount,
    note: body.note?.trim() || null,
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
