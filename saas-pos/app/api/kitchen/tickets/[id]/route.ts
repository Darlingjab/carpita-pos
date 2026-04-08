import { NextResponse } from "next/server";
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
  return NextResponse.json({ data: t });
}
