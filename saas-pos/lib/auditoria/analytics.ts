import { hourInBusinessTimeZone, weekdayMon1ToSun7 } from "@/lib/business-datetime";
import type { Product, Sale, SaleItem } from "@/lib/types";

export type TimePreset = "today" | "yesterday" | "week" | "month" | "year" | "custom";

export type BCGQuadrant = "star" | "cash_cow" | "question" | "dog";

export type TrendDir = "up" | "down" | "flat";

export interface DateRange {
  start: Date;
  end: Date;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Lunes como inicio de semana (es-ES). */
function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function getDateRangeForPreset(preset: TimePreset, custom?: { from: Date; to: Date }): DateRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "week":
      return { start: startOfWeekMonday(now), end: endOfDay(now) };
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    case "custom": {
      if (!custom) return { start: startOfDay(now), end: endOfDay(now) };
      return { start: startOfDay(custom.from), end: endOfDay(custom.to) };
    }
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export function previousPeriodRange(range: DateRange): DateRange {
  const ms = range.end.getTime() - range.start.getTime() + 1;
  const end = new Date(range.start.getTime() - 1);
  const start = new Date(end.getTime() - ms + 1);
  return { start, end };
}

export function saleInRange(s: Sale, range: DateRange): boolean {
  const t = new Date(s.createdAt).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

export function filterSalesInRange(sales: Sale[], range: DateRange): Sale[] {
  return sales.filter((s) => saleInRange(s, range));
}

function costForLine(item: SaleItem, costByProductId: Map<string, number>): number {
  const unitCost = costByProductId.get(item.productId) ?? 0;
  return unitCost * item.qty;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function buildCostMap(products: Product[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of products) {
    m.set(p.id, p.cost ?? 0);
  }
  return m;
}

export interface ProductAgg {
  productId: string;
  name: string;
  qtySold: number;
  revenue: number;
  costTotal: number;
  profit: number;
  marginPct: number;
  lineCount: number;
  orderCount: number;
  avgLineValue: number;
  peakHour: number | null;
  hourQty: number[];
  trend: TrendDir;
  trendPct: number;
  bcg: BCGQuadrant;
}

function classifyBcg(
  revenue: number,
  marginPct: number,
  medRev: number,
  medMargin: number,
): BCGQuadrant {
  const highVol = revenue >= medRev;
  const highMargin = marginPct >= medMargin;
  if (highVol && highMargin) return "star";
  if (highVol && !highMargin) return "cash_cow";
  if (!highVol && highMargin) return "question";
  return "dog";
}

function revenueInHalf(
  sales: Sale[],
  productId: string,
  range: DateRange,
  firstHalf: boolean,
  costByProductId: Map<string, number>,
): number {
  const mid = range.start.getTime() + (range.end.getTime() - range.start.getTime()) / 2;
  let sum = 0;
  for (const s of sales) {
    const t = new Date(s.createdAt).getTime();
    if (t < range.start.getTime() || t > range.end.getTime()) continue;
    const inFirst = t < mid;
    if (inFirst !== firstHalf) continue;
    for (const it of s.items) {
      if (it.productId.startsWith("prd_hist_")) continue;
      if (it.productId !== productId) continue;
      sum += it.lineTotal - costForLine(it, costByProductId);
    }
  }
  return sum;
}

export interface AggregateResult {
  rows: ProductAgg[];
  medRevenue: number;
  medMarginPct: number;
  /** Mediana de tickets que incluyen el producto (útil para el mapa cuando el margen % es plano). */
  medOrderCount: number;
}

/** Nombre de línea para auditoría: catálogo, o primer tramo antes de " · " (ej. ticket "Local · Mesa 15" → "Local"). */
export function displayNameForSaleLine(rawLineName: string, catalogName?: string): string {
  const c = catalogName?.trim();
  if (c) return c;
  const n = rawLineName.trim();
  const sep = n.indexOf(" · ");
  if (sep > 0) return n.slice(0, sep).trim();
  return n || "—";
}

/** Nombre para filas de auditoría (solo catálogo real; las líneas prd_hist_* no se agregan). */
export function labelAuditoriaRow(productId: string, rawLineName: string, catalogName?: string): string {
  return displayNameForSaleLine(rawLineName, catalogName);
}

export function aggregateProducts(
  sales: Sale[],
  range: DateRange,
  costByProductId: Map<string, number>,
  productNamesById?: Map<string, string>,
): AggregateResult {
  const map = new Map<
    string,
    {
      name: string;
      qty: number;
      revenue: number;
      cost: number;
      lines: number;
      orders: Set<string>;
      hourQty: number[];
    }
  >();

  for (const s of sales) {
    if (!saleInRange(s, range)) continue;
    const h = hourInBusinessTimeZone(s.createdAt);
    for (const it of s.items) {
      if (it.productId.startsWith("prd_hist_")) continue;
      const cur = map.get(it.productId) ?? {
        name: labelAuditoriaRow(it.productId, it.name, productNamesById?.get(it.productId)),
        qty: 0,
        revenue: 0,
        cost: 0,
        lines: 0,
        orders: new Set<string>(),
        hourQty: Array.from({ length: 24 }, () => 0),
      };
      cur.name = labelAuditoriaRow(it.productId, it.name, productNamesById?.get(it.productId));
      cur.qty += it.qty;
      cur.revenue += it.lineTotal;
      cur.cost += costForLine(it, costByProductId);
      cur.lines += 1;
      cur.orders.add(s.id);
      cur.hourQty[h] = (cur.hourQty[h] ?? 0) + it.qty;
      map.set(it.productId, cur);
    }
  }

  const revenues = [...map.values()].map((v) => v.revenue).filter((r) => r > 0);
  const margins: number[] = [];
  for (const v of map.values()) {
    if (v.revenue <= 0) continue;
    margins.push(((v.revenue - v.cost) / v.revenue) * 100);
  }
  const medRev = median(revenues);
  const medMargin = median(margins.length ? margins : [0]);

  const out: ProductAgg[] = [];
  for (const [productId, v] of map) {
    const profit = v.revenue - v.cost;
    const marginPct = v.revenue > 0 ? (profit / v.revenue) * 100 : 0;
    let peakH: number | null = null;
    let peakQ = 0;
    for (let hi = 0; hi < 24; hi++) {
      if (v.hourQty[hi]! > peakQ) {
        peakQ = v.hourQty[hi]!;
        peakH = hi;
      }
    }
    if (peakQ === 0) peakH = null;

    const p1 = revenueInHalf(sales, productId, range, true, costByProductId);
    const p2 = revenueInHalf(sales, productId, range, false, costByProductId);
    let trend: TrendDir = "flat";
    let trendPct = 0;
    if (p1 > 0 || p2 > 0) {
      const base = p1;
      if (base <= 0 && p2 > 0) {
        trend = "up";
        trendPct = 100;
      } else if (base > 0) {
        trendPct = ((p2 - p1) / base) * 100;
        if (trendPct > 8) trend = "up";
        else if (trendPct < -8) trend = "down";
      }
    }

    out.push({
      productId,
      name: v.name,
      qtySold: v.qty,
      revenue: v.revenue,
      costTotal: v.cost,
      profit,
      marginPct,
      lineCount: v.lines,
      orderCount: v.orders.size,
      avgLineValue: v.lines > 0 ? v.revenue / v.lines : 0,
      peakHour: peakH,
      hourQty: v.hourQty,
      trend,
      trendPct,
      bcg: classifyBcg(v.revenue, marginPct, medRev || 1, medMargin),
    });
  }

  out.sort((a, b) => b.revenue - a.revenue);

  const orderCounts = out.map((p) => p.orderCount).filter((o) => o > 0);
  const medOrd = median(orderCounts.length ? orderCounts : [1]);

  return {
    rows: out,
    medRevenue: medRev || 1,
    medMarginPct: medMargin,
    medOrderCount: Math.max(1, medOrd),
  };
}

export interface BusinessSummary {
  saleCount: number;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  marginPct: number;
  avgTicket: number;
  prevRevenue: number;
  prevNetProfit: number;
  revenueChangePct: number;
  profitChangePct: number;
}

export function summarizeBusiness(
  sales: Sale[],
  range: DateRange,
  prevRange: DateRange,
  costByProductId: Map<string, number>,
): BusinessSummary {
  const cur = filterSalesInRange(sales, range);
  const prev = filterSalesInRange(sales, prevRange);

  let totalRev = 0;
  let totalCost = 0;
  for (const s of cur) {
    totalRev += s.total;
    for (const it of s.items) {
      totalCost += costForLine(it, costByProductId);
    }
  }
  const net = totalRev - totalCost;
  const tickets = cur.length;
  const avgTicket = tickets > 0 ? totalRev / tickets : 0;

  let pRev = 0;
  let pCost = 0;
  for (const s of prev) {
    pRev += s.total;
    for (const it of s.items) {
      pCost += costForLine(it, costByProductId);
    }
  }
  const pNet = pRev - pCost;

  const revenueChangePct = pRev > 0 ? ((totalRev - pRev) / pRev) * 100 : totalRev > 0 ? 100 : 0;
  const profitChangePct = pNet !== 0 ? ((net - pNet) / Math.abs(pNet)) * 100 : net > 0 ? 100 : 0;

  return {
    saleCount: tickets,
    totalRevenue: totalRev,
    totalCost,
    netProfit: net,
    marginPct: totalRev > 0 ? (net / totalRev) * 100 : 0,
    avgTicket,
    prevRevenue: pRev,
    prevNetProfit: pNet,
    revenueChangePct,
    profitChangePct,
  };
}

export interface HourlyTraffic {
  hour: number;
  saleCount: number;
  revenue: number;
}

export function hourlyTraffic(sales: Sale[], range: DateRange): HourlyTraffic[] {
  const cur = filterSalesInRange(sales, range);
  const arr: HourlyTraffic[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    saleCount: 0,
    revenue: 0,
  }));
  for (const s of cur) {
    const h = hourInBusinessTimeZone(s.createdAt);
    arr[h]!.saleCount += 1;
    arr[h]!.revenue += s.total;
  }
  return arr;
}

/** dow: 1 = lunes … 7 = domingo (orden de visualización Lun → Dom). */
export interface DayTraffic {
  dow: number;
  label: string;
  saleCount: number;
  revenue: number;
}

const DOW_MON_FIRST_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function dayOfWeekTraffic(sales: Sale[], range: DateRange): DayTraffic[] {
  const cur = filterSalesInRange(sales, range);
  const base: DayTraffic[] = DOW_MON_FIRST_LABELS.map((label, i) => ({
    dow: i + 1,
    label,
    saleCount: 0,
    revenue: 0,
  }));
  for (const s of cur) {
    const idx = weekdayMon1ToSun7(s.createdAt) - 1;
    if (idx < 0 || idx > 6) continue;
    base[idx]!.saleCount += 1;
    base[idx]!.revenue += s.total;
  }
  return base;
}

export interface ProductPair {
  idA: string;
  idB: string;
  nameA: string;
  nameB: string;
  count: number;
}

export function topCoPurchasedPairs(
  sales: Sale[],
  range: DateRange,
  productNamesById?: Map<string, string>,
  limit = 8,
): ProductPair[] {
  const cur = filterSalesInRange(sales, range);
  const counts = new Map<string, { idA: string; idB: string; nameA: string; nameB: string; count: number }>();
  for (const s of cur) {
    const byId = new Map<string, { name: string }>();
    for (const it of s.items) {
      if (it.productId.startsWith("prd_hist_")) continue;
      if (!byId.has(it.productId)) {
        byId.set(it.productId, {
          name: labelAuditoriaRow(it.productId, it.name, productNamesById?.get(it.productId)),
        });
      }
    }
    const ids = [...byId.keys()].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const key = `${a}|${b}`;
        const nameA = byId.get(a)!.name;
        const nameB = byId.get(b)!.name;
        const prev = counts.get(key);
        if (prev) prev.count += 1;
        else counts.set(key, { idA: a, idB: b, nameA, nameB, count: 1 });
      }
    }
  }
  return [...counts.values()]
    .sort((x, y) => y.count - x.count)
    .slice(0, limit)
    .map(({ idA, idB, nameA, nameB, count }) => ({ idA, idB, nameA, nameB, count }));
}

export interface AuditAlert {
  id: string;
  severity: "info" | "warn" | "risk";
  title: string;
  detail: string;
}

export function buildAlerts(products: ProductAgg[], summary: BusinessSummary): AuditAlert[] {
  const alerts: AuditAlert[] = [];
  for (const p of products) {
    if (p.revenue > 0 && p.marginPct < 12) {
      alerts.push({
        id: `margin-${p.productId}`,
        severity: "warn",
        title: "Margen bajo",
        detail: `${p.name}: margen ${p.marginPct.toFixed(1)} % sobre ingresos — revisa precio o costo.`,
      });
    }
    if (p.trend === "down" && p.revenue > 0 && p.trendPct < -18) {
      alerts.push({
        id: `trend-${p.productId}`,
        severity: "risk",
        title: "Caída de venta",
        detail: `${p.name}: la contribución bruta cayó ~${Math.abs(p.trendPct).toFixed(0)} % en la 2.ª mitad del período.`,
      });
    }
  }
  if (summary.revenueChangePct < -12 && summary.saleCount > 0) {
    alerts.push({
      id: "biz-revenue",
      severity: "warn",
      title: "Ventas vs período anterior",
      detail: `Los ingresos bajaron ${Math.abs(summary.revenueChangePct).toFixed(1)} % respecto al tramo anterior equivalente.`,
    });
  }
  return alerts.slice(0, 12);
}

export interface AiRecommendation {
  id: string;
  text: string;
}

export function buildHeuristicRecommendations(
  products: ProductAgg[],
  summary: BusinessSummary,
  hourly: HourlyTraffic[],
  dow: DayTraffic[],
  pairs: ProductPair[],
): AiRecommendation[] {
  const recs: AiRecommendation[] = [];

  const dogs = products.filter((p) => p.bcg === "dog" && p.revenue > 0).slice(0, 3);
  for (const p of dogs) {
    recs.push({
      id: `dog-${p.productId}`,
      text: `Evaluar retirar o reformular «${p.name}» (baja rotación y bajo margen relativo).`,
    });
  }

  const stars = products.filter((p) => p.bcg === "star").slice(0, 2);
  for (const p of stars) {
    if (p.marginPct < 35) {
      recs.push({
        id: `price-${p.productId}`,
        text: `«${p.name}» vende bien: si el mercado lo permite, prueba un aumento de precio moderado (5–10 %).`,
      });
    }
  }

  const sortedH = [...hourly].sort((a, b) => a.saleCount - b.saleCount);
  const quiet = sortedH.slice(0, 3).filter((h) => h.hour >= 11 && h.hour <= 21);
  if (quiet.length) {
    const labels = quiet.map((h) => `${h.hour}:00`).join(", ");
    recs.push({
      id: "promo-hours",
      text: `Horas con menos tickets: ${labels}. Valorar happy hour o promos focalizadas.`,
    });
  }

  const bestDow = [...dow].sort((a, b) => b.revenue - a.revenue)[0];
  if (bestDow && bestDow.revenue > 0) {
    recs.push({
      id: "dow-demand",
      text: `Mayor demanda relativa los ${bestDow.label}: refuerza personal o existencias esos días.`,
    });
  }

  for (const pair of pairs.slice(0, 2)) {
    recs.push({
      id: `combo-${pair.idA}-${pair.idB}`,
      text: `«${pair.nameA}» y «${pair.nameB}» suelen ir juntos (${pair.count} tickets). Considera un combo explícito.`,
    });
  }

  if (summary.netProfit < 0 && summary.totalRevenue > 0) {
    recs.push({
      id: "cost-review",
      text: "El período muestra margen total negativo: revisa costos registrados en Productos y precios.",
    });
  }

  recs.push({
    id: "inv-placeholder",
    text: "Mermas y agotamiento de ingredientes: cuando conectes inventario y recetas, aquí podrán alertarse automáticamente.",
  });

  return recs.slice(0, 10);
}
