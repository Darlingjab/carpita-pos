import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { pushRuntimeToCloud } from "@/lib/cloud-sync";
import { getRegisterSessionState } from "@/lib/register-session-store";
import { addCustomerPointsMovement, addRegisterMovement, addSale, findCustomer } from "@/lib/store";
import { getCurrentBusinessMock, getSessionUserOrNull, hasPermission } from "@/lib/auth";
import { mergeHistoricalSalesWithLive } from "@/lib/sales-merge";
import { salesVisibleToRole } from "@/lib/sales-access";
import { Sale, type SalePayment } from "@/lib/types";

function sumPayments(payments: SalePayment[] | undefined): number {
  return (payments ?? []).reduce((a, p) => a + Math.max(0, Number(p.amount) || 0), 0);
}

export async function GET() {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const base = mergeHistoricalSalesWithLive();
  return NextResponse.json({ data: salesVisibleToRole(base, user) });
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
  const totalNum = Number(body.total) || 0;
  const paySum = sumPayments(body.payments);
  /** Ventas a total $0 (100% descuento, cortesía, etc.): no exigir líneas de pago. */
  if (totalNum > 0) {
    if (paySum <= 0 || paySum + 0.05 < totalNum) {
      return NextResponse.json(
        {
          error: "payments_mismatch",
          message: "La suma de medios de pago debe cubrir al menos el total de la venta.",
        },
        { status: 400 },
      );
    }
  } else if (paySum > 0.05) {
    return NextResponse.json(
      {
        error: "payments_mismatch",
        message: "El total de la venta es cero: no registres cobros en esta venta.",
      },
      { status: 400 },
    );
  }

  const overpay = Math.round((paySum - totalNum) * 100) / 100;
  const bodyChange = Number((body as Sale).changeGiven);
  const mergedChange =
    overpay > 0.05
      ? Math.max(overpay, Number.isFinite(bodyChange) ? bodyChange : 0)
      : Number.isFinite(bodyChange) && bodyChange > 0.05
        ? bodyChange
        : null;

  const sale: Sale = {
    ...body,
    id: `sale_${randomUUID()}`,
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
    changeGiven: mergedChange,
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
  const cashGross = (sale.payments ?? [])
    .filter((p) => p.method === "cash")
    .reduce((a, p) => a + Math.max(0, Number(p.amount) || 0), 0);
  const chg = Math.max(0, Number(sale.changeGiven) || 0);
  const cashIn = Math.max(0, Math.round((cashGross - Math.min(chg, cashGross)) * 100) / 100);
  if (cashIn > 0) {
    const payParts =
      (sale.payments ?? [])
        .map((p) => `${p.method} $${Number(p.amount).toFixed(2)}`)
        .join(" · ") || "—";
    addRegisterMovement({
      id: `mov_in_${sale.id}`,
      businessId: business.id,
      type: "in",
      amount: cashIn,
      note: `Venta ${sale.id} (${payParts})${discNote}`,
      createdAt: sale.createdAt,
      createdBy: user.id,
    });
  }

  const pushed = await pushRuntimeToCloud();
  return NextResponse.json(
    {
      data: sale,
      cloudSynced: pushed.ok,
      ...(pushed.ok ? {} : { cloudWarning: pushed.error ?? "sync_failed" }),
    },
    { status: 201 },
  );
}
