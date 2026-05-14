/** Ajustes de impresión de tickets/comandas (localStorage). */

export const PRINTER_SETTINGS_KEY = "pos_printer_settings_saas_v1";

export type PrinterTicketSettings = {
  // ─── Identidad del ticket ───────────────────────────────────────────
  /** Nombre del restaurante en el encabezado del ticket */
  storeName: string;
  /** URL del logo (imagen) que aparece en el ticket. Vacío = sin logo */
  logoUrl: string;
  /** Texto de despedida al pie (ej: "¡Gracias por visitarnos!") */
  footerLine: string;

  // ─── Papel y texto ──────────────────────────────────────────────────
  paperWidth: "58mm" | "80mm";
  fontScale: "compact" | "normal" | "large";
  /** Mostrar fecha y hora en la comanda y el recibo */
  showDateTime: boolean;

  // ─── Comportamiento de impresión ────────────────────────────────────
  /** Abrir diálogo del sistema automáticamente al generar el ticket */
  autoPrint: boolean;
  /** Imprimir comanda en cocina automáticamente al enviar pedido */
  printKitchenAuto: boolean;
  /** Imprimir recibo del cliente automáticamente al cobrar */
  printReceiptAuto: boolean;
};

export const defaultPrinterSettings: PrinterTicketSettings = {
  storeName: "Carpita",
  logoUrl: "",
  footerLine: "¡Gracias por visitarnos!",
  paperWidth: "80mm",
  fontScale: "normal",
  showDateTime: true,
  autoPrint: true,
  printKitchenAuto: true,
  printReceiptAuto: true,
};

export function loadPrinterSettings(): PrinterTicketSettings {
  if (typeof window === "undefined") return defaultPrinterSettings;
  try {
    const r = localStorage.getItem(PRINTER_SETTINGS_KEY);
    if (!r) return defaultPrinterSettings;
    const parsed = JSON.parse(r) as Partial<PrinterTicketSettings>;
    return { ...defaultPrinterSettings, ...parsed };
  } catch {
    return defaultPrinterSettings;
  }
}
