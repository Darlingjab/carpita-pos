import { NextResponse } from "next/server";
import { getSessionUserOrNull, hasPermission } from "@/lib/auth";
import { importedSalesSeed } from "@/lib/data/imported-sales-sample";
import { resolveExportRangeFromSearchParams, dateToYmd, saleInRange } from "@/lib/export-period";
import { salesToImportedRegisterMovements } from "@/lib/import-sales-movements";
import { registerMovementCashDelta } from "@/lib/register-balance";
import type { Sale } from "@/lib/types";

function esc(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function cashInFromSale(s: Sale): number {
  const cashGross = (s.payments ?? [])
    .filter((p) => p.method === "cash")
    .reduce((a, p) => a + Math.max(0, Number(p.amount) || 0), 0);
  const chg = Math.max(0, Number(s.changeGiven) || 0);
  return Math.max(0, Math.round((cashGross - Math.min(chg, cashGross)) * 100) / 100);
}

export async function GET(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "reports.read") && !hasPermission(user, "sales.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const range = resolveExportRangeFromSearchParams(url.searchParams);
  const sales = importedSalesSeed.filter((s) => saleInRange(s.createdAt, range));
  const movements = salesToImportedRegisterMovements(sales);
  const saleByMovId = new Map<string, Sale>();
  for (const s of sales) saleByMovId.set(`mov_imp_${s.id}`, s);

  const headers = [
    "id",
    "type",
    "amount",
    "cashDelta",
    "cashInDrawer",
    "note",
    "createdAt",
    "saleId",
    "payments",
  ];
  const csv = [
    headers.join(","),
    ...movements.map((m) => {
      const sale = saleByMovId.get(m.id);
      const cashIn = sale ? cashInFromSale(sale) : 0;
      const pay =
        sale?.payments?.map((p) => `${p.method}:${Number(p.amount).toFixed(2)}`).join(" | ") ?? "";
      return [
        esc(m.id),
        esc(m.type),
        esc(Number(m.amount ?? 0).toFixed(2)),
        esc(Number(registerMovementCashDelta(m)).toFixed(2)),
        esc(cashIn.toFixed(2)),
        esc(m.note ?? ""),
        esc(m.createdAt),
        esc(sale?.id ?? ""),
        esc(pay),
      ].join(",");
    }),
  ].join("\n");

  const tag =
    range === "all" ? "todo" : `${dateToYmd(new Date(range.fromMs))}_${dateToYmd(new Date(range.toMs))}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="movimientos_reporte_ventas_${tag}.csv"`,
    },
  });
}
