import { NextResponse } from "next/server";
import { getRegisterSessionState } from "@/lib/register-session-store";
import {
  addCustomerPointsMovement,
  addRegisterMovement,
  addSale,
  findCustomer,
  getSales,
} from "@/lib/store";
import { getCurrentBusinessMock, getSessionUserOrNull, hasPermission } from "@/lib/auth";
import { salesVisibleToRole } from "@/lib/sales-access";
import { Sale } from "@/lib/types";

export async function GET() {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ data: salesVisibleToRole(getSales(), user) });
}

export async function POST(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "sales.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!getRegisterSessionState().isOpen) {
    return NextResponse.json(
      {
        error: "register_closed",
        message: "Debes abrir caja en Ventas → Arqueos antes de cobrar.",
      },
      { status: 403 },
    );
  }
  const business = getCurrentBusinessMock();
  const body = (await request.json()) as Omit<
    Sale,
    "id" | "businessId" | "createdAt" | "createdBy"
  >;
  const sale: Sale = {
    ...body,
    id: `sale_${Date.now()}`,
    businessId: business.id,
    createdAt: new Date().toISOString(),
    createdBy: user.id,
    customerName: body.customerName ?? null,
    customerId: (body as Sale).customerId ?? null,
    serverId: body.serverId ?? user.id,
    serverName: body.serverName ?? user.fullName,
    discountPercent: body.discountPercent ?? null,
    discountType: body.discountType ?? null,
    discountDescription: body.discountDescription ?? null,
    tenderedCash: (body as Sale).tenderedCash ?? null,
    changeGiven: (body as Sale).changeGiven ?? null,
  };
  addSale(sale);

  // Plan de recompensas (demo): 1 punto por cada $1 de total (solo mesas).
  // Se acumula si viene customerId y existe el cliente.
  if (sale.channel === "table" && sale.customerId) {
    const c = findCustomer(sale.customerId);
    const pts = Math.max(0, Math.floor(Number(sale.total) || 0));
    if (c && pts > 0) {
      addCustomerPointsMovement({
        id: `pt_${sale.id}`,
        businessId: business.id,
        customerId: c.id,
        type: "earn",
        points: pts,
        ref: sale.id,
        createdAt: sale.createdAt,
      });
    }
  }

  const discNote =
    sale.discount && sale.discount > 0
      ? ` | Desc. ${sale.discountType ?? ""} ${sale.discountPercent ?? ""}% ${sale.discountDescription ? `(${sale.discountDescription})` : ""} −$${sale.discount.toFixed(2)}`
      : "";
  addRegisterMovement({
    id: `mov_in_${sale.id}`,
    businessId: business.id,
    type: "in",
    amount: sale.total,
    note: `Venta ${sale.id}${discNote}`,
    createdAt: sale.createdAt,
    createdBy: user.id,
  });

  return NextResponse.json({ data: sale }, { status: 201 });
}
