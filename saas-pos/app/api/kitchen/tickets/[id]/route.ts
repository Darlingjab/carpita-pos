import { NextResponse } from "next/server";
import { pushRuntimeToCloud } from "@/lib/cloud-sync";
import type { KitchenTicketStatus } from "@/lib/types";
import { updateKitchenTicketStatus } from "@/lib/store";
import { getSessionUserOrNull, hasPermission } from "@/lib/auth";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "kitchen.access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await request.json()) as { status: KitchenTicketStatus };
  const t = updateKitchenTicketStatus(id, body.status);
  if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const pushed = await pushRuntimeToCloud();
  if (!pushed.ok) {
    return NextResponse.json(
      { error: "cloud_sync_failed", detail: pushed.error },
      { status: 503 },
    );
  }
  return NextResponse.json({ data: t });
}
