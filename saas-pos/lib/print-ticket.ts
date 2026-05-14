/**
 * Sistema de impresión POS — ventana popup optimizada para impresoras térmicas 58mm/80mm.
 *
 * Genera dos tipos de documentos:
 *  - Comanda de cocina: sin precios, solo productos y cantidades (va a cocina)
 *  - Recibo de cliente: con precios, totales, forma de pago y cambio (va al cliente)
 *
 * Funcionamiento: abre window.open("about:blank") e inyecta HTML+CSS completo.
 * El CSS incluye @page para respetar el ancho real del papel térmico.
 * Si autoPrint=true, dispara window.print() automáticamente en onload.
 */

import type { PrinterTicketSettings } from "@/lib/printer-settings";
import { loadPrinterSettings } from "@/lib/printer-settings";

export type TicketLine = { name: string; qty: number };

export type SaleReceiptData = {
  storeName?: string;
  tableLabel?: string;
  serverName?: string;
  customerName?: string;
  items: { name: string; qty: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  total: number;
  payments: { method: "cash" | "card" | "transfer"; amount: number }[];
  tenderedCash?: number | null;
  changeGiven?: number | null;
  discountType?: string | null;
  discountDescription?: string | null;
  discountPercent?: number | null;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMoney(n: number) {
  return `$${Math.abs(n).toFixed(2)}`;
}

function methodLabel(m: "cash" | "card" | "transfer") {
  return m === "cash" ? "Efectivo" : m === "card" ? "Tarjeta" : "Transferencia";
}

function pageSize(paper: PrinterTicketSettings["paperWidth"]) {
  return paper === "58mm" ? "58mm" : "80mm";
}

function logoBlock(logoUrl: string, fs: number) {
  if (!logoUrl.trim()) return "";
  return `<div class="center" style="margin-bottom:6px;">
    <img src="${esc(logoUrl.trim())}" alt="Logo" style="max-height:${fs * 5}px; max-width:100%; object-fit:contain;" onerror="this.style.display='none'"/>
  </div>`;
}

function fontPx(scale: PrinterTicketSettings["fontScale"]) {
  return scale === "compact" ? 11 : scale === "large" ? 14 : 12;
}

function fmtDate(d: Date) {
  return d.toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** CSS base compartido por todos los tickets */
function baseCss(settings: PrinterTicketSettings, fs: number) {
  const pw = pageSize(settings.paperWidth);
  return `
    @page {
      size: ${pw} auto;
      margin: 0;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${fs}px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 8px 6px 16px;
      width: 100%;
      max-width: ${pw === "58mm" ? "210px" : "290px"};
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .sep  { border: none; border-top: 1px dashed #555; margin: 6px 0; }
    .sep-solid { border: none; border-top: 1px solid #000; margin: 6px 0; }
    .row  { display: flex; justify-content: space-between; gap: 4px; }
    .row .name { flex: 1; min-width: 0; overflow-wrap: break-word; }
    .row .val  { white-space: nowrap; flex-shrink: 0; }
    .item-qty  { font-weight: bold; min-width: 2ch; display: inline-block; }
    h1 { font-size: ${fs + 2}px; margin: 6px 0 2px; font-weight: bold; }
    h2 { font-size: ${fs + 1}px; margin: 4px 0 2px; font-weight: bold; }
    p  { margin: 2px 0; }
    ul { margin: 4px 0; padding: 0; list-style: none; }
    li { margin: 3px 0; }
    .tag {
      display: inline-block;
      border: 1px solid #000;
      padding: 1px 6px;
      font-weight: bold;
      letter-spacing: 0.05em;
    }
    /* Botón imprimir — solo visible en pantalla, no al imprimir */
    .print-btn-bar {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: #1e293b;
      padding: 10px 16px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .print-btn {
      flex: 1;
      background: #22c55e;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      letter-spacing: 0.03em;
    }
    .close-btn {
      background: #475569;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    @media print {
      .print-btn-bar { display: none !important; }
      body { padding-bottom: 4px; }
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  `;
}

/** Abre la ventana popup con el HTML del ticket */
function openTicketWindow(html: string, title: string): boolean {
  const w = window.open(
    "",
    "_blank",
    "width=400,height=660,resizable=yes,scrollbars=yes",
  );
  if (!w) {
    window.alert(
      "⚠️ El navegador bloqueó la ventana emergente.\n\nPermití los popups para este sitio en la barra de dirección y volvé a intentar.",
    );
    return false;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = title;
  return true;
}

function printScript(autoPrint: boolean) {
  if (!autoPrint) return "";
  // Usamos setTimeout para asegurar que el DOM está completamente cargado antes de imprimir
  return `<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 120); });<\/script>`;
}

// ─────────────────────────────────────────────
// Comanda de cocina (sin precios)
// ─────────────────────────────────────────────

export function printKitchenTicket(opts: {
  title: string;
  subtitle?: string;
  lines: TicketLine[];
}) {
  const settings = loadPrinterSettings();
  const fs = fontPx(settings.fontScale);
  const now = new Date();

  const logo = logoBlock(settings.logoUrl, fs);
  const storeLine = settings.storeName.trim()
    ? `<p class="center bold" style="font-size:${fs + 3}px;">${esc(settings.storeName.trim())}</p>`
    : "";
  const dateLine = settings.showDateTime
    ? `<p class="center" style="font-size:${fs - 1}px; color:#444;">${esc(fmtDate(now))}</p>`
    : "";
  const footer = settings.footerLine.trim()
    ? `<hr class="sep"/><p class="center" style="font-size:${fs - 1}px;">${esc(settings.footerLine.trim())}</p>`
    : "";

  const itemsHtml = opts.lines
    .map((l) => `<li><span class="item-qty">${l.qty}×</span> ${esc(l.name)}</li>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Comanda</title>
  <style>${baseCss(settings, fs)}</style>
</head>
<body>
  ${logo}
  ${storeLine}
  <hr class="sep-solid"/>
  <p class="center"><span class="tag">🍳 COCINA</span></p>
  <h1>${esc(opts.title)}</h1>
  ${opts.subtitle ? `<p>${esc(opts.subtitle)}</p>` : ""}
  ${dateLine}
  <hr class="sep"/>
  <ul>${itemsHtml}</ul>
  ${footer}
  ${printScript(settings.autoPrint)}
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir comanda</button>
    <button class="close-btn" onclick="window.close()">✕</button>
  </div>
</body>
</html>`;

  openTicketWindow(html, "Comanda cocina");
}

// ─────────────────────────────────────────────
// Recibo de cliente (con precios y pago)
// ─────────────────────────────────────────────

export function printSaleReceipt(data: SaleReceiptData) {
  const settings = loadPrinterSettings();
  const fs = fontPx(settings.fontScale);
  const now = new Date();

  const storeName = (data.storeName ?? settings.storeName).trim();
  const logo = logoBlock(settings.logoUrl, fs);
  const storeLine = storeName
    ? `<p class="center bold" style="font-size:${fs + 3}px;">${esc(storeName)}</p>`
    : "";

  const headerInfo = [
    data.tableLabel ? `Mesa: ${data.tableLabel}` : null,
    data.serverName ? `Mesero: ${data.serverName}` : null,
    data.customerName && data.customerName !== "Sin cliente"
      ? `Cliente: ${data.customerName}`
      : null,
  ]
    .filter(Boolean)
    .map((l) => `<p>${esc(l!)}</p>`)
    .join("");

  const dateLine = settings.showDateTime
    ? `<p class="center" style="font-size:${fs - 1}px; color:#444;">${esc(fmtDate(now))}</p>`
    : "";

  const itemsHtml = data.items
    .map((i) => {
      const name = i.qty > 1 ? `${i.qty}× ${i.name}` : i.name;
      return `<li class="row">
        <span class="name">${esc(name)}</span>
        <span class="val">${fmtMoney(i.lineTotal)}</span>
      </li>`;
    })
    .join("");

  const discountLine =
    data.discount > 0
      ? (() => {
          const label = data.discountType
            ? `Dto. ${data.discountPercent != null ? `${data.discountPercent}%` : ""} ${data.discountDescription ?? ""}`.trim()
            : "Descuento";
          return `<div class="row"><span class="name">${esc(label)}</span><span class="val">-${fmtMoney(data.discount)}</span></div>`;
        })()
      : "";

  const paymentLines = data.payments
    .map(
      (p) =>
        `<div class="row"><span class="name">${esc(methodLabel(p.method))}</span><span class="val">${fmtMoney(p.amount)}</span></div>`,
    )
    .join("");

  const changeLine =
    data.changeGiven != null && data.changeGiven > 0
      ? `<div class="row bold"><span class="name">Cambio</span><span class="val">${fmtMoney(data.changeGiven)}</span></div>`
      : "";

  const footer =
    settings.footerLine.trim()
      ? `<hr class="sep"/><p class="center" style="font-size:${fs - 1}px;">${esc(settings.footerLine.trim())}</p>`
      : `<p class="center" style="font-size:${fs - 1}px; margin-top:8px;">¡Gracias por su visita!</p>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Recibo</title>
  <style>${baseCss(settings, fs)}</style>
</head>
<body>
  ${logo}
  ${storeLine}
  <hr class="sep-solid"/>
  ${headerInfo}
  ${dateLine}
  <hr class="sep"/>
  <ul>${itemsHtml}</ul>
  <hr class="sep"/>
  ${data.subtotal !== data.total ? `<div class="row"><span class="name">Subtotal</span><span class="val">${fmtMoney(data.subtotal)}</span></div>` : ""}
  ${discountLine}
  <div class="row bold" style="font-size:${fs + 2}px; margin-top:4px;">
    <span class="name">TOTAL</span>
    <span class="val">${fmtMoney(data.total)}</span>
  </div>
  <hr class="sep"/>
  ${paymentLines}
  ${changeLine}
  ${footer}
  ${printScript(settings.autoPrint)}
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir recibo</button>
    <button class="close-btn" onclick="window.close()">✕</button>
  </div>
</body>
</html>`;

  openTicketWindow(html, "Recibo cliente");
}

// ─────────────────────────────────────────────
// Pre-cuenta (ver cuenta antes de cobrar)
// ─────────────────────────────────────────────

export function printPreCuenta(opts: {
  tableLabel?: string;
  serverName?: string;
  items: { name: string; qty: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  total: number;
}) {
  const settings = loadPrinterSettings();
  const fs = fontPx(settings.fontScale);
  const now = new Date();
  const storeName = settings.storeName.trim();
  const logo = logoBlock(settings.logoUrl, fs);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Pre-cuenta</title>
  <style>${baseCss(settings, fs)}</style>
</head>
<body>
  ${logo}
  ${storeName ? `<p class="center bold" style="font-size:${fs + 3}px;">${esc(storeName)}</p>` : ""}
  <hr class="sep-solid"/>
  <p class="center"><span class="tag">PRE-CUENTA</span></p>
  ${opts.tableLabel ? `<p class="center">Mesa: ${esc(opts.tableLabel)}</p>` : ""}
  ${opts.serverName ? `<p class="center">Mesero: ${esc(opts.serverName)}</p>` : ""}
  <p class="center" style="font-size:${fs - 1}px; color:#444;">${esc(fmtDate(now))}</p>
  <hr class="sep"/>
  <ul>
    ${opts.items
      .map(
        (i) => `<li class="row">
      <span class="name">${i.qty > 1 ? `${i.qty}× ` : ""}${esc(i.name)}</span>
      <span class="val">${fmtMoney(i.lineTotal)}</span>
    </li>`,
      )
      .join("")}
  </ul>
  <hr class="sep"/>
  ${opts.discount > 0 ? `<div class="row"><span class="name">Descuento</span><span class="val">-${fmtMoney(opts.discount)}</span></div>` : ""}
  <div class="row bold" style="font-size:${fs + 2}px;">
    <span class="name">TOTAL</span>
    <span class="val">${fmtMoney(opts.total)}</span>
  </div>
  <hr class="sep"/>
  <p class="center" style="font-size:${fs - 1}px;">Este no es su recibo oficial</p>
  ${printScript(settings.autoPrint)}
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir pre-cuenta</button>
    <button class="close-btn" onclick="window.close()">✕</button>
  </div>
</body>
</html>`;

  openTicketWindow(html, "Pre-cuenta");
}

export function openCashDrawerStub() {
  window.dispatchEvent(new CustomEvent("pos-open-cash-drawer"));
}
