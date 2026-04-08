import { NextResponse } from "next/server";
import { getCurrentBusinessMock, getSessionUserOrNull, hasPermission } from "@/lib/auth";
import type { KitchenTicket, SaleItem, SaleChannel } from "@/lib/types";
import { addKitchenTicket, getKitchenTickets } from "@/lib/store";

export async function GET() {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "kitchen.access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ data: getKitchenTickets() });
}

export async function POST(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "sales.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const business = getCurrentBusinessMock();
  const body = (await request.json()) as {
    channel: SaleChannel;
    tableId: string | null;
    tableLabel: string | null;
    counterOrderId: string | null;
    items: SaleItem[];
  };
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items_required" }, { status: 400 });
  }
  const ticket: KitchenTicket = {
    id: `kds_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    businessId: business.id,
    channel: body.channel,
    tableId: body.tableId,
    tableLabel: body.tableLabel,
    counterOrderId: body.counterOrderId,
    items: body.items,
    status: "pending",
    createdAt: new Date().toISOString(),
    readyAt: null,
  };
  addKitchenTicket(ticket);
  return NextResponse.json({ data: ticket }, { status: 201 });
}
