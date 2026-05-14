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
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const rows = toRows(sales);
  const grandTotal = sales.reduce((n, s) => n + Number(s.total || 0), 0);

  // A4 landscape: 842 × 595 pt
  const PW = 842;
  const PH = 595;
  const ML = 36; // margin left
  const MR = 36; // margin right
  const MB = 28; // margin bottom
  const ROW_H = 12;
  // Columna widths (must sum to PW - ML - MR = 770)
  const COLS = [
    { label: "Fecha", w: 128 },
    { label: "Cliente", w: 140 },
    { label: "Mesa", w: 60 },
    { label: "Mesero", w: 110 },
    { label: "Canal", w: 70 },
    { label: "Dto.", w: 56 },
    { label: "Total", w: 70, right: true },
    { label: "Efectivo", w: 68, right: true },
    { label: "Tarjeta", w: 68, right: true },
  ];

  function truncate(text: string, maxW: number, size = 8) {
    // Approximate: Helvetica ≈ 0.52 × size per char
    const max = Math.floor(maxW / (size * 0.52));
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }

  function drawHeader(page: ReturnType<typeof pdf.addPage>, yPos: number) {
    let x = ML;
    for (const col of COLS) {
      page.drawText(col.label, {
        x: col.right ? x + col.w - col.label.length * 4.2 : x,
        y: yPos,
        size: 7.5,
        font: bold,
        color: rgb(0.35, 0.35, 0.45),
      });
      x += col.w;
    }
    page.drawLine({
      start: { x: ML, y: yPos - 3 },
      end: { x: PW - MR, y: yPos - 3 },
      thickness: 0.6,
      color: rgb(0.75, 0.75, 0.82),
    });
    return yPos - ROW_H - 2;
  }

  function newPage(isFirst = false) {
    const p = pdf.addPage([PW, PH]);
    let y = PH - 30;

    if (isFirst) {
      // Title block
      p.drawText("Reporte de ventas — Carpita Restaurante", {
        x: ML, y, size: 15, font: bold, color: rgb(0.08, 0.08, 0.15),
      });
      y -= 18;
      const sourceLabel = source === "imported" ? "Histórico importado" : "Sesión POS";
      p.drawText(`${sourceLabel}  ·  Período: ${from} → ${to}  ·  ${rows.length} transacciones  ·  Total: $${grandTotal.toFixed(2)}`, {
        x: ML, y, size: 9, font, color: rgb(0.4, 0.4, 0.4),
      });
      y -= 20;
      p.drawLine({ start: { x: ML, y }, end: { x: PW - MR, y }, thickness: 1, color: rgb(0.2, 0.2, 0.5) });
      y -= 14;
    } else {
      p.drawText(`Reporte de ventas — Carpita  ·  ${from} → ${to} (cont.)`, {
        x: ML, y, size: 9, font, color: rgb(0.4, 0.4, 0.4),
      });
      y -= 14;
    }

    return { p, y };
  }

  let { p: curPage, y } = newPage(true);
  y = drawHeader(curPage, y);

  for (let i = 0; i < rows.length; i++) {
    if (y < MB + ROW_H) {
      ({ p: curPage, y } = newPage(false));
      y = drawHeader(curPage, y);
    }

    const r = rows[i];
    const vals = [
      r.fecha.slice(0, 19),
      r.cliente || "—",
      r.mesa || "—",
      r.mesero || "—",
      r.canal,
      Number(r.descuento) > 0 ? `-$${r.descuento}` : "—",
      `$${r.total}`,
      Number(r.pago_efectivo) > 0 ? `$${r.pago_efectivo}` : "—",
      Number(r.pago_tarjeta) > 0 ? `$${r.pago_tarjeta}` : "—",
    ];

    const rowBg = i % 2 === 0 ? rgb(0.97, 0.97, 0.99) : rgb(1, 1, 1);
    curPage.drawRectangle({
      x: ML,
      y: y - 2,
      width: PW - ML - MR,
      height: ROW_H,
      color: rowBg,
    });

    let x = ML;
    for (let c = 0; c < COLS.length; c++) {
      const col = COLS[c];
      const text = truncate(vals[c] ?? "—", col.w - 4);
      const textX = col.right
        ? x + col.w - text.replace("…", "").length * 4.2 - 4
        : x + 2;
      curPage.drawText(text, {
        x: textX,
        y: y + 1,
        size: 8,
        font: Number(r.descuento) > 0 && c === 5 ? bold : font,
        color: c === 6 ? rgb(0.1, 0.45, 0.15) : rgb(0.1, 0.1, 0.1),
      });
      x += col.w;
    }
    y -= ROW_H;
  }

  // Footer: page numbers
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    pages[i].drawText(`Pág. ${i + 1} / ${pages.length}`, {
      x: PW - MR - 55,
      y: 14,
      size: 8,
      font,
      color: rgb(0.55, 0.55, 0.55),
    });
    pages[i].drawText(`Carpita Restaurante  ·  Generado ${new Date().toLocaleDateString("es-EC")}`, {
      x: ML,
      y: 14,
      size: 8,
      font,
      color: rgb(0.55, 0.55, 0.55),
    });
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
