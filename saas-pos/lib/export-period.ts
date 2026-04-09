/** Rango local (YYYY-MM-DD) para exportaciones. */

export type ExportPeriodPreset = "day" | "week" | "month";

export function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function rangeForPreset(period: ExportPeriodPreset, ref: Date = new Date()): { from: string; to: string } {
  const to = dateToYmd(ref);
  if (period === "day") return { from: to, to };
  if (period === "week") {
    const start = new Date(ref);
    start.setHours(0, 0, 0, 0);
    const dow = start.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    start.setDate(start.getDate() + diff);
    return { from: dateToYmd(start), to };
  }
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  return { from: dateToYmd(start), to };
}

export type ResolvedExportRange = { fromMs: number; toMs: number } | "all";

/** Prioridad: from+to explícitos; si no, period preset; si no, todo el histórico. */
export function resolveExportRangeFromSearchParams(
  sp: URLSearchParams,
  ref: Date = new Date(),
): ResolvedExportRange {
  const from = sp.get("from")?.trim() ?? "";
  const to = sp.get("to")?.trim() ?? "";
  if (from && to) {
    const fromMs = new Date(`${from}T00:00:00`).getTime();
    const toMs = new Date(`${to}T23:59:59.999`).getTime();
    if (Number.isFinite(fromMs) && Number.isFinite(toMs)) return { fromMs, toMs };
  }
  const period = sp.get("period")?.toLowerCase() ?? "";
  if (period === "day" || period === "week" || period === "month") {
    const { from: f, to: t } = rangeForPreset(period, ref);
    return {
      fromMs: new Date(`${f}T00:00:00`).getTime(),
      toMs: new Date(`${t}T23:59:59.999`).getTime(),
    };
  }
  return "all";
}

export function saleInRange(createdAt: string, range: ResolvedExportRange): boolean {
  if (range === "all") return true;
  const ms = new Date(createdAt).getTime();
  if (!Number.isFinite(ms)) return false;
  return ms >= range.fromMs && ms <= range.toMs;
}

export function monthKeyOverlapsRange(ym: string, range: ResolvedExportRange): boolean {
  if (range === "all") return true;
  const parts = ym.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  if (!y || !mo) return false;
  const start = new Date(y, mo - 1, 1).getTime();
  const end = new Date(y, mo, 0, 23, 59, 59, 999).getTime();
  return end >= range.fromMs && start <= range.toMs;
}
