/** Impresión comanda / ticket cocina (preview + diálogo de impresión). Conecta hardware vía impresora del sistema. */

import type { PrinterTicketSettings } from "@/lib/printer-settings";
import { loadPrinterSettings } from "@/lib/printer-settings";

export type TicketLine = { name: string; qty: number };

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fontPx(scale: PrinterTicketSettings["fontScale"]) {
  if (scale === "compact") return 12;
  if (scale === "large") return 15;
  return 13;
}

function titlePx(scale: PrinterTicketSettings["fontScale"]) {
  if (scale === "compact") return 14;
  if (scale === "large") return 17;
  return 15;
}

function paperMaxWidth(paper: PrinterTicketSettings["paperWidth"]) {
  return paper === "58mm" ? "220px" : "300px";
}

export function printKitchenTicket(opts: {
  title: string;
  subtitle?: string;
  lines: TicketLine[];
}) {
  const settings = loadPrinterSettings();
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) {
    window.alert("Permite ventanas emergentes para imprimir la comanda.");
    return;
  }

  const maxW = paperMaxWidth(settings.paperWidth);
  const bodyFs = fontPx(settings.fontScale);
  const hFs = titlePx(settings.fontScale);
  const header =
    settings.storeName.trim().length > 0
      ? `<p style="margin:0 0 4px;font-weight:800;font-size:${hFs}px;text-align:center;border-bottom:1px dashed #ccc;padding-bottom:6px;">${escapeHtml(settings.storeName.trim())}</p>`
      : "";
  const dateBlock = settings.showDateTime
    ? `<p style="margin:0 0 8px;font-size:${Math.max(10, bodyFs - 2)}px;color:#666;">${escapeHtml(new Date().toLocaleString("es-EC"))}</p>`
    : "";
  const footer =
    settings.footerLine.trim().length > 0
      ? `<p style="margin:12px 0 0;padding-top:8px;border-top:1px dashed #ccc;font-size:${Math.max(10, bodyFs - 1)}px;color:#555;text-align:center;">${escapeHtml(settings.footerLine.trim())}</p>`
      : "";

  const printScript = settings.autoPrint
    ? `window.onload=function(){window.print();};`
    : `/* Sin auto-imprimir: usa el menú Imprimir o Ctrl/Cmd+P */`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Comanda</title>
<style>
  @media print { body { margin: 0; } }
</style></head>
<body style="font-family:system-ui,sans-serif;font-size:${bodyFs}px;padding:12px;max-width:${maxW};margin:0 auto;">
  ${header}
  <h2 style="margin:0 0 6px;font-size:${hFs}px;">${escapeHtml(opts.title)}</h2>
  ${opts.subtitle ? `<p style="margin:0 0 6px;color:#444;">${escapeHtml(opts.subtitle)}</p>` : ""}
  ${dateBlock}
  <ul style="margin:0;padding-left:18px;">
    ${opts.lines.map((l) => `<li style="margin-bottom:4px;"><strong>${l.qty}×</strong> ${escapeHtml(l.name)}</li>`).join("")}
  </ul>
  ${footer}
  <script>${printScript}</script>
</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function openCashDrawerStub() {
  window.dispatchEvent(new CustomEvent("pos-open-cash-drawer"));
}
