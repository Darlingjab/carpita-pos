import { NextResponse } from "next/server";
import { pushRuntimeToCloud } from "@/lib/cloud-sync";
import { registerMovementCashDelta } from "@/lib/register-balance";
import { getCurrentBusinessMock, getSessionUserOrNull, hasPermission } from "@/lib/auth";
import {
  addRegisterMovement,
  findRegisterMovementById,
  hasVoidingAdjustmentFor,
} from "@/lib/store";

export async function POST(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "users.manage")) {
    return NextResponse.json({ error: "Forbidden", message: "Solo administradores." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { targetId?: string };
  const targetId = (body.targetId ?? "").trim();
  if (!targetId) {
    return NextResponse.json({ error: "target_required" }, { status: 400 });
  }

  const target = findRegisterMovementById(targetId);
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (target.type === "close") {
    return NextResponse.json(
      { error: "cannot_void_close", message: "Los cierres no afectan el saldo; use un ajuste manual si necesita nota." },
      { status: 400 },
    );
  }
  if (hasVoidingAdjustmentFor(targetId)) {
    return NextResponse.json(
      { error: "already_voided", message: "Este movimiento ya fue anulado en caja." },
      { status: 409 },
    );
  }

  const reversal = -registerMovementCashDelta(target);
  const business = getCurrentBusinessMock();
  const movement = {
    id: `mov_adj_${Date.now()}`,
    businessId: business.id,
    type: "adjustment" as const,
    amount: reversal,
    note: `Anulación admin del movimiento ${targetId} (${target.type}, registro $${Math.abs(Number(target.amount) || 0).toFixed(2)})`,
    createdAt: new Date().toISOString(),
    createdBy: user.id,
    voidsMovementId: targetId,
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
