import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { pushRuntimeToCloud } from "@/lib/cloud-sync";
import { getCurrentBusinessMock, getSessionUserOrNull, hasPermission } from "@/lib/auth";
import { addRegisterMovement } from "@/lib/store";

export async function POST(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "users.manage")) {
    return NextResponse.json({ error: "Forbidden", message: "Solo administradores." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { amount?: number; note?: string };
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json(
      { error: "invalid_amount", message: "Indique un monto distinto de cero (positivo entra, negativo sale)." },
      { status: 400 },
    );
  }
  const note = (body.note ?? "").trim();
  if (note.length < 3) {
    return NextResponse.json(
      { error: "note_required", message: "Describe el motivo del ajuste (mín. 3 caracteres)." },
      { status: 400 },
    );
  }

  const business = getCurrentBusinessMock();
  const movement = {
    id: `mov_adj_${randomUUID()}`,
    businessId: business.id,
    type: "adjustment" as const,
    amount,
    note: `Ajuste manual (admin): ${note}`,
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
