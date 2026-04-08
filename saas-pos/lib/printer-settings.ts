/** Ajustes de impresión de tickets/comandas (localStorage hasta Supabase). */

export const PRINTER_SETTINGS_KEY = "pos_printer_settings_saas_v1";

export type PrinterTicketSettings = {
  /** Nombre o leyenda del local en el encabezado del ticket */
  storeName: string;
  paperWidth: "58mm" | "80mm";
  /** Si es true, al abrir la ventana de impresión se dispara print automáticamente */
  autoPrint: boolean;
  /** Texto opcional al pie del ticket */
  footerLine: string;
  /** Tamaño base del texto en la vista previa */
  fontScale: "compact" | "normal" | "large";
  /** Mostrar fecha y hora bajo el subtítulo */
  showDateTime: boolean;
};

export const defaultPrinterSettings: PrinterTicketSettings = {
  storeName: "Mi local",
  paperWidth: "80mm",
  autoPrint: true,
  footerLine: "",
  fontScale: "normal",
  showDateTime: true,
};

export function loadPrinterSettings(): PrinterTicketSettings {
  if (typeof window === "undefined") {
    return defaultPrinterSettings;
  }
  try {
    const r = localStorage.getItem(PRINTER_SETTINGS_KEY);
    if (!r) return defaultPrinterSettings;
    const parsed = JSON.parse(r) as Partial<PrinterTicketSettings>;
    return { ...defaultPrinterSettings, ...parsed };
  } catch {
    return defaultPrinterSettings;
  }
}
