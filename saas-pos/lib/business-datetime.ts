/**
 * Zona horaria fija para informes de auditoría (no la del navegador del cajero).
 * Ajustá con NEXT_PUBLIC_BUSINESS_TIMEZONE (IANA), p. ej. America/Mexico_City.
 */
export const BUSINESS_TIMEZONE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE
    ? process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE
    : "America/Guayaquil";

/** Etiqueta corta para textos de UI. */
export function getBusinessTimezoneDisplayName(): string {
  if (BUSINESS_TIMEZONE === "America/Guayaquil") return "Ecuador (Guayaquil)";
  const tail = BUSINESS_TIMEZONE.split("/").pop()?.replace(/_/g, " ") ?? BUSINESS_TIMEZONE;
  return tail;
}

/** Etiqueta de reloj del negocio para una hora 0–23 (misma escala que `hourInBusinessTimeZone`). */
export function formatBusinessHourClock(hour: number): string {
  const h = Math.min(23, Math.max(0, Math.floor(hour)));
  return `${String(h).padStart(2, "0")}:00`;
}

/** Rango horario local del negocio para tooltips (barra de 18 → 18:00–19:00). */
export function formatBusinessHourRangeLabel(hour: number): string {
  const h = Math.min(23, Math.max(0, Math.floor(hour)));
  const next = (h + 1) % 24;
  return `${formatBusinessHourClock(h)}–${String(next).padStart(2, "0")}:00`;
}

/** Hora 0–23 según el reloj del negocio (IANA). */
export function hourInBusinessTimeZone(isoOrDate: string | Date): number {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: BUSINESS_TIMEZONE,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value;
  const n = parseInt(h ?? "0", 10);
  return Number.isFinite(n) ? Math.min(23, Math.max(0, n)) : 0;
}

/**
 * Día de la semana de la **fecha local del negocio** (calendario gregoriano en esa zona).
 * Devuelve 1 = lunes … 7 = domingo (para listados Lun → Dom).
 */
export function weekdayMon1ToSun7(isoOrDate: string | Date): number {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const ca = d.toLocaleDateString("en-CA", { timeZone: BUSINESS_TIMEZONE });
  const parts = ca.split("-").map(Number);
  const Y = parts[0]!;
  const M = parts[1]!;
  const Day = parts[2]!;
  const utcNoon = Date.UTC(Y, M - 1, Day, 12, 0, 0);
  const jsDow = new Date(utcNoon).getUTCDay();
  return jsDow === 0 ? 7 : jsDow;
}
