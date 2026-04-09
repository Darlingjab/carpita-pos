import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSessionUserOrNull, hasPermission } from "@/lib/auth";
import { importedSalesSeed } from "@/lib/data/imported-sales-sample";
import { resolveExportRangeFromSearchParams, dateToYmd, saleInRange } from "@/lib/export-period";
import { salesVisibleToRole } from "@/lib/sales-access";
import { getSales } from "@/lib/store";
import type { Sale } from "@/lib/types";

function escCsv(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function sumMethod(s: Sale, m: "cash" | "card" | "transfer") {
  return (s.payments ?? []).filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0);
}

function toRows(sales: Sale[]) {
  return sales.map((s) => ({
    id: s.id,
    fecha: new Date(s.createdAt).toLocaleString("es-EC"),
    canal: s.channel,
    mesa: s.tableId ?? "",
    cliente: s.customerName ?? "",
    mesero: s.serverName ?? "",
    subtotal: Number(s.subtotal ?? 0).toFixed(2),
    descuento: Number(s.discount ?? 0).toFixed(2),
    total: Number(s.total ?? 0).toFixed(2),
    pago_efectivo: sumMethod(s, "cash").toFixed(2),
    pago_tarjeta: sumMethod(s, "card").toFixed(2),
    pago_transferencia: sumMethod(s, "transfer").toFixed(2),
    pago_detalle: (s.payments ?? []).map((p) => `${p.method}:${p.amount.toFixed(2)}`).join(" | "),
    items: (s.items ?? []).map((i) => `${i.qty}x ${i.name}`).join(" | "),
  }));
}

async function buildPdf(sales: Sale[], from: string, to: string, source: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const rows = toRows(sales);
  const total = sales.reduce((n, s) => n + Number(s.total || 0), 0);
  let y = 560;

  page.drawText("Reporte de ventas", { x: 40, y, size: 18, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 24;
  page.drawText(`Fuente: ${source} | Rango: ${from} a ${to}`, { x: 40, y, size: 10, font });
  y -= 16;
  page.drawText(`Transacciones: ${rows.length} | Total: $${total.toFixed(2)}`, { x: 40, y, size: 10, font });
  y -= 18;
  page.drawText("Fecha | Cliente | Mesa | Total", { x: 40, y, size: 10, font: bold });
  y -= 12;

  const show = rows.slice(0, 28);
  for (const r of show) {
    if (y < 30) break;
    const line = `${r.fecha} | ${r.cliente || "—"} | ${r.mesa || "—"} | $${r.total}`;
    page.drawText(line.slice(0, 145), { x: 40, y, size: 9, font });
    y -= 11;
  }
  if (rows.length > show.length && y > 20) {
    page.drawText(`... ${rows.length - show.length} ventas adicionales`, { x: 40, y, size: 9, font });
  }
  return Buffer.from(await pdf.save());
}

export async function GET(request: Request) {
  const user = await getSessionUserOrNull();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user, "reports.read") && !hasPermission(user, "sales.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  const source = (url.searchParams.get("source") ?? "session").toLowerCase();
  const server = url.searchParams.get("server") ?? "";
  const range = resolveExportRangeFromSearchParams(url.searchParams);

  if (source === "imported" && !hasPermission(user, "reports.read")) {
    return NextResponse.json(
      { error: "Forbidden", message: "Solo administradores pueden exportar el histórico importado." },
      { status: 403 },
    );
  }

  const base = source === "imported" ? importedSalesSeed : getSales();
  const filtered = base.filter((s) => {
    if (!saleInRange(s.createdAt, range)) return false;
    if (server && server !== "all" && server !== "_all") {
      return (s.serverName ?? "—") === server;
    }
    return true;
  });
  const sales = salesVisibleToRole(filtered, user);

  const safeFrom =
    range === "all" ? "inicio" : dateToYmd(new Date(range.fromMs));
  const safeTo = range === "all" ? "fin" : dateToYmd(new Date(range.toMs));

  if (format === "pdf") {
    const file = await buildPdf(sales, safeFrom, safeTo, source);
    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"ventas_${source}_${safeFrom}_${safeTo}.pdf\"`,
      },
    });
  }

  const rows = toRows(sales);
  const headers = [
    "id",
    "fecha",
    "canal",
    "mesa",
    "cliente",
    "mesero",
    "subtotal",
    "descuento",
    "total",
    "pago_efectivo",
    "pago_tarjeta",
    "pago_transferencia",
    "pago_detalle",
    "items",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escCsv((r as Record<string, string>)[h])).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"ventas_${source}_${safeFrom}_${safeTo}.csv\"`,
    },
  });
}
