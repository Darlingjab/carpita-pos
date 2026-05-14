"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  ChevronDown,
  Database,
  LayoutGrid,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  formatBusinessHourClock,
  formatBusinessHourRangeLabel,
  getBusinessTimezoneDisplayName,
} from "@/lib/business-datetime";
import { demoProducts } from "@/lib/mock-data";
import type { Sale } from "@/lib/types";
import { useMergedCatalog } from "@/lib/hooks/useMergedCatalog";
import { es } from "@/lib/locale";
import {
  aggregateProducts,
  buildAlerts,
  buildCostMap,
  buildHeuristicRecommendations,
  dayOfWeekTraffic,
  filterSalesInRange,
  getDateRangeForPreset,
  hourlyTraffic,
  previousPeriodRange,
  summarizeBusiness,
  topCoPurchasedPairs,
  type BCGQuadrant,
  type DayTraffic,
  type HourlyTraffic,
  type ProductAgg,
  type TimePreset,
} from "@/lib/auditoria/analytics";

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function bcgStyle(q: BCGQuadrant): { bg: string; border: string; label: string } {
  switch (q) {
    case "star":
      return { bg: "bg-emerald-100", border: "border-emerald-400", label: es.auditoria.bcgStar };
    case "cash_cow":
      return { bg: "bg-sky-100", border: "border-sky-400", label: es.auditoria.bcgCow };
    case "question":
      return { bg: "bg-amber-100", border: "border-amber-400", label: es.auditoria.bcgQuestion };
    default:
      return { bg: "bg-slate-200", border: "border-slate-400", label: es.auditoria.bcgDog };
  }
}

function formatVsPrev(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const arrow = pct >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(pct).toFixed(1)} % vs período anterior`;
}

function trendIcon(t: ProductAgg["trend"]) {
  if (t === "up") return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
  if (t === "down") return <TrendingDown className="h-3.5 w-3.5 text-rose-600" />;
  return <span className="text-[0.65rem] text-slate-400">—</span>;
}

function groupTopByBcg(products: ProductAgg[], limit: number) {
  const qs = ["star", "cash_cow", "question", "dog"] as const;
  const m = new Map<BCGQuadrant, ProductAgg[]>();
  for (const q of qs) m.set(q, []);
  for (const p of products) {
    if (p.revenue <= 0) continue;
    m.get(p.bcg)?.push(p);
  }
  const out: Record<(typeof qs)[number], ProductAgg[]> = {
    star: [],
    cash_cow: [],
    question: [],
    dog: [],
  };
  for (const q of qs) {
    out[q] = (m.get(q) ?? []).sort((x, y) => y.revenue - x.revenue).slice(0, limit);
  }
  return out;
}

const PLOT_PAD = 6;

function HourBarChart({
  hourly,
  maxH,
  hoursHint,
  tzLabel,
}: {
  hourly: HourlyTraffic[];
  maxH: number;
  hoursHint: string;
  tzLabel: string;
}) {
  const max = Math.max(1, maxH);
  const plotH = 120;
  return (
    <div className="mt-3">
      <p className="mb-2 text-[0.65rem] leading-snug text-slate-500">{hoursHint}</p>
      <div className="overflow-x-auto pb-1">
        <div className="flex h-[148px] min-w-[720px] items-end gap-0.5 border-b border-slate-200 px-0.5 sm:min-w-[760px]">
          {hourly.map((h) => {
            const barPx =
              max > 0
                ? Math.max(h.saleCount > 0 ? 5 : 2, (h.saleCount / max) * plotH)
                : 2;
            const clock = formatBusinessHourClock(h.hour);
            const range = formatBusinessHourRangeLabel(h.hour);
            return (
              <div
                key={h.hour}
                className="flex min-w-[26px] flex-1 flex-col items-center justify-end gap-0.5"
              >
                <div
                  className="w-full max-w-[28px] rounded-t-md bg-[var(--pos-primary)] shadow-sm transition-opacity hover:opacity-90"
                  style={{ height: `${barPx}px` }}
                  title={`${range} (${tzLabel}) · ${h.saleCount} tickets · ${fmtMoney(h.revenue)}`}
                />
                <span className="max-w-full truncate text-center text-[0.45rem] font-semibold tabular-nums leading-none text-slate-500 sm:text-[0.5rem]">
                  {clock}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-1 text-center text-[0.6rem] text-slate-500">
        {es.auditoria.chartHoursAxisTz.replace("{tz}", tzLabel)}
      </p>
    </div>
  );
}

function DowBarChart({ dow, maxD }: { dow: DayTraffic[]; maxD: number }) {
  const max = Math.max(1, maxD);
  const plotH = 128;
  return (
    <div className="mt-3">
      <p className="mb-2 text-[0.65rem] leading-snug text-slate-500">{es.auditoria.chartDaysHint}</p>
      <div className="flex h-[200px] items-end justify-between gap-1.5 border-b border-slate-200 px-1 sm:gap-2 sm:px-2">
        {dow.map((d) => {
          const barPx =
            max > 0 ? Math.max(d.revenue > 0 ? 6 : 2, (d.revenue / max) * plotH) : 2;
          return (
            <div key={d.dow} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="max-w-full truncate text-center text-[0.55rem] font-bold tabular-nums text-emerald-800 sm:text-[0.6rem]">
                {d.revenue > 0 ? fmtMoney(d.revenue) : "—"}
              </span>
              <div
                className="w-full rounded-t-md bg-slate-700 shadow-sm"
                style={{ height: `${barPx}px` }}
                title={`${d.label}: ${fmtMoney(d.revenue)} · ${d.saleCount} tickets`}
              />
              <span className="text-[0.65rem] font-extrabold text-slate-800">{d.label}</span>
              <span className="text-[0.5rem] tabular-nums text-slate-500">{d.saleCount} tk</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AuditoriaView() {
  const catalog = useMergedCatalog(demoProducts);
  const costMap = useMemo(() => buildCostMap(catalog), [catalog]);
  const productNamesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of catalog) m.set(p.id, p.name);
    return m;
  }, [catalog]);

  const [sales, setSales] = useState<Sale[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [preset, setPreset] = useState<TimePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showStack, setShowStack] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoadErr(null);
    try {
      const r = await fetch("/api/sales");
      if (!r.ok) {
        setLoadErr(r.status === 401 ? es.auditoria.needLogin : es.auditoria.loadError);
        setSales([]);
        return;
      }
      const j = await r.json();
      setSales(Array.isArray(j.data) ? j.data : []);
    } catch {
      setLoadErr(es.auditoria.loadError);
      setSales([]);
    }
  }, []);

  useEffect(() => {
    void fetchSales();
  }, [fetchSales]);

  useEffect(() => {
    function onUpd() {
      void fetchSales();
    }
    window.addEventListener("pos-sales-updated", onUpd);
    return () => window.removeEventListener("pos-sales-updated", onUpd);
  }, [fetchSales]);

  const range = useMemo(() => {
    if (preset !== "custom") return getDateRangeForPreset(preset);
    const from = customFrom ? new Date(customFrom) : new Date();
    const to = customTo ? new Date(customTo) : new Date();
    return getDateRangeForPreset("custom", { from, to });
  }, [preset, customFrom, customTo]);

  const prevRange = useMemo(() => previousPeriodRange(range), [range]);

  const analytics = useMemo(() => {
    if (!sales) return null;
    const inRange = filterSalesInRange(sales, range);
    const agg = aggregateProducts(sales, range, costMap, productNamesById);
    const products = agg.rows;
    const summary = summarizeBusiness(sales, range, prevRange, costMap);
    const hourly = hourlyTraffic(sales, range);
    const dow = dayOfWeekTraffic(sales, range);
    const pairs = topCoPurchasedPairs(sales, range, productNamesById);
    const alerts = buildAlerts(products, summary);
    const recs = buildHeuristicRecommendations(products, summary, hourly, dow, pairs);
    const maxH = Math.max(1, ...hourly.map((h) => h.saleCount));
    const maxD = Math.max(1, ...dow.map((d) => d.revenue));
    return {
      inRange,
      products,
      medRevenue: agg.medRevenue,
      medMarginPct: agg.medMarginPct,
      medOrderCount: agg.medOrderCount,
      summary,
      hourly,
      dow,
      pairs,
      alerts,
      recs,
      maxH,
      maxD,
    };
  }, [sales, range, prevRange, costMap, productNamesById]);

  if (sales === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>{es.auditoria.loading}</span>
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <p className="font-bold">{loadErr}</p>
      </div>
    );
  }

  const a = analytics!;
  const tzLabel = getBusinessTimezoneDisplayName();
  const hoursHint = es.auditoria.chartHoursHint.replace("{tz}", tzLabel);

  const matrixProducts = a.products.filter((p) => p.revenue > 0);
  const maxRev = Math.max(1, ...matrixProducts.map((p) => p.revenue));
  const maxOrd = Math.max(1, ...matrixProducts.map((p) => p.orderCount));
  const bcgLists = groupTopByBcg(a.products, 8);

  const vLinePct = PLOT_PAD + (Math.min(1, a.medRevenue / maxRev) * (100 - 2 * PLOT_PAD));
  const hLinePct = PLOT_PAD + (Math.min(1, a.medOrderCount / maxOrd) * (100 - 2 * PLOT_PAD));

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">{es.auditoria.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">{es.auditoria.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                "today",
                "yesterday",
                "week",
                "month",
                "year",
                "custom",
              ] as const
            ).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`rounded-lg border px-2.5 py-1.5 text-[0.65rem] font-extrabold uppercase tracking-wide sm:text-xs ${
                  preset === p
                    ? "border-[var(--pos-primary)] bg-[var(--pos-primary)] text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {es.auditoria.presets[p]}
              </button>
            ))}
          </div>
        </div>
        {preset === "custom" && (
          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
            <label className="text-xs font-semibold text-slate-600">
              {es.auditoria.from}
              <input
                type="date"
                className="mt-1 block rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              {es.auditoria.to}
              <input
                type="date"
                className="mt-1 block rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </label>
          </div>
        )}
        <p className="mt-2 text-[0.65rem] text-slate-500">
          {es.auditoria.rangeLabel}: {range.start.toLocaleDateString("es")} — {range.end.toLocaleDateString("es")} ·{" "}
          {a.inRange.length} {es.auditoria.salesInRange}
        </p>
      </header>

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: es.auditoria.kpiRevenue, v: fmtMoney(a.summary.totalRevenue), pct: a.summary.revenueChangePct, sub: null },
          { k: es.auditoria.kpiProfit, v: fmtMoney(a.summary.netProfit), pct: a.summary.profitChangePct, sub: null },
          { k: es.auditoria.kpiMargin, v: `${a.summary.marginPct.toFixed(1)} %`, pct: null, sub: es.auditoria.kpiMarginHint },
          { k: es.auditoria.kpiTicket, v: fmtMoney(a.summary.avgTicket), pct: null, sub: `${a.summary.saleCount} ${es.auditoria.tickets}` },
        ].map((card) => (
          <div
            key={card.k}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">{card.k}</p>
            <p className="mt-1 text-xl font-black tabular-nums text-slate-900 sm:text-2xl">{card.v}</p>
            {card.pct != null && Number.isFinite(card.pct) ? (
              <p className={`mt-1.5 flex items-center gap-1 text-[0.7rem] font-bold ${card.pct >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                <span>{card.pct >= 0 ? "↑" : "↓"}</span>
                <span>{Math.abs(card.pct).toFixed(1)}% vs período anterior</span>
              </p>
            ) : (
              <p className="mt-1 text-[0.7rem] text-slate-600">{card.sub}</p>
            )}
          </div>
        ))}
      </section>

      {/* BCG + matrix chart */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-800">
            <LayoutGrid className="h-4 w-4" />
            {es.auditoria.bcgTitle}
          </h2>
          <p className="mt-1 text-xs text-slate-600">{es.auditoria.bcgExplain}</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-[0.65rem] sm:grid-cols-4">
            {(["star", "cash_cow", "question", "dog"] as const).map((q) => {
              const st = bcgStyle(q);
              return (
                <li key={q} className={`rounded-lg border px-2 py-1.5 ${st.bg} ${st.border}`}>
                  <span className="font-bold text-slate-900">{st.label}</span>
                </li>
              );
            })}
          </ul>
          <h3 className="mt-4 text-[0.65rem] font-black uppercase tracking-wide text-slate-600">
            {es.auditoria.bcgListTitle}
          </h3>
          {a.products.filter((p) => p.revenue > 0).length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">{es.auditoria.bcgListEmpty}</p>
          ) : (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {(["star", "cash_cow", "question", "dog"] as const).map((q) => {
                const st = bcgStyle(q);
                const rows = bcgLists[q];
                return (
                  <div key={q} className={`rounded-lg border p-2.5 ${st.border} ${st.bg}`}>
                    <p className="text-[0.6rem] font-black uppercase text-slate-800">{st.label}</p>
                    <ul className="mt-1.5 space-y-1 text-[0.7rem] text-slate-800">
                      {rows.length === 0 ? (
                        <li className="text-slate-500">—</li>
                      ) : (
                        rows.map((p) => (
                          <li key={p.productId} className="flex justify-between gap-2">
                            <span className="min-w-0 truncate font-medium" title={p.name}>
                              {p.name}
                            </span>
                            <span className="shrink-0 tabular-nums text-emerald-900">{fmtMoney(p.revenue)}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">{es.auditoria.matrixTitle}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{es.auditoria.matrixAxis}</p>
          {matrixProducts.length === 0 ? (
            <p className="mt-6 text-center text-sm text-slate-500">{es.auditoria.matrixEmpty}</p>
          ) : (
            <div className="relative mx-auto mt-4 h-[280px] w-full max-w-md rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/90">
              <div className="absolute left-2 top-2 max-w-[45%] text-[0.55rem] font-semibold leading-tight text-slate-600">
                {es.auditoria.axisTickets}
              </div>
              <div className="absolute bottom-2 right-2 text-[0.55rem] font-semibold text-slate-600">
                {es.auditoria.axisVolume}
              </div>
              <div className="absolute inset-3">
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-0 w-px bg-slate-500/70"
                  style={{ left: `${vLinePct}%` }}
                />
                <div
                  className="pointer-events-none absolute left-0 right-0 z-0 h-px bg-slate-500/70"
                  style={{ bottom: `${hLinePct}%` }}
                />
                {matrixProducts.slice(0, 48).map((p) => {
                  const x =
                    PLOT_PAD + (p.revenue / maxRev) * (100 - 2 * PLOT_PAD);
                  const yBottom =
                    PLOT_PAD + (p.orderCount / maxOrd) * (100 - 2 * PLOT_PAD);
                  const yTop = 100 - yBottom;
                  const st = bcgStyle(p.bcg);
                  return (
                    <button
                      key={p.productId}
                      type="button"
                      title={`${p.name} · ${st.label} · ${fmtMoney(p.revenue)} · ${p.orderCount} tickets`}
                      className={`absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm ${st.border} ${st.bg} hover:scale-125 hover:ring-2 hover:ring-slate-400/40`}
                      style={{ left: `${x}%`, top: `${yTop}%` }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-black uppercase text-slate-800">{es.auditoria.chartHours}</h2>
          <HourBarChart hourly={a.hourly} maxH={a.maxH} hoursHint={hoursHint} tzLabel={tzLabel} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-black uppercase text-slate-800">{es.auditoria.chartDays}</h2>
          <DowBarChart dow={a.dow} maxD={a.maxD} />
        </div>
      </section>

      {/* AI + alerts */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase text-violet-950">
            <Brain className="h-4 w-4" />
            {es.auditoria.aiTitle}
          </h2>
          <p className="mt-1 text-xs text-violet-900/80">{es.auditoria.aiDisclaimer}</p>
          <ul className="mt-3 space-y-2">
            {a.recs.map((r) => (
              <li key={r.id} className="flex gap-2 text-sm text-slate-800">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 shadow-sm sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase text-amber-950">
            <AlertTriangle className="h-4 w-4" />
            {es.auditoria.alertsTitle}
          </h2>
          {a.alerts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">{es.auditoria.alertsEmpty}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {a.alerts.map((al) => (
                <li
                  key={al.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    al.severity === "risk"
                      ? "border-rose-200 bg-rose-50 text-rose-950"
                      : al.severity === "warn"
                        ? "border-amber-200 bg-white text-amber-950"
                        : "border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  <span className="font-bold">{al.title}</span>
                  <span className="block text-[0.8rem] opacity-90">{al.detail}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[0.65rem] text-slate-500">{es.auditoria.inventoryNote}</p>
        </div>
      </section>

      {a.inRange.length > 0 && a.products.length === 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950">
          {es.auditoria.catalogOnlyEmpty}
        </div>
      )}

      {/* Product table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-black uppercase text-slate-800">{es.auditoria.tableTitle}</h2>
          <p className="text-xs text-slate-600">{es.auditoria.tableHint}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[0.65rem] font-bold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 sm:px-4">{es.auditoria.thProduct}</th>
                <th className="px-2 py-2">{es.auditoria.thBcg}</th>
                <th className="px-2 py-2">{es.auditoria.thQty}</th>
                <th className="px-2 py-2">{es.auditoria.thRevenue}</th>
                <th className="px-2 py-2">{es.auditoria.thCost}</th>
                <th className="px-2 py-2">{es.auditoria.thMargin}</th>
                <th className="px-2 py-2">{es.auditoria.thAvgLine}</th>
                <th className="px-2 py-2">{es.auditoria.thPeak}</th>
                <th className="px-2 py-2">{es.auditoria.thTrend}</th>
              </tr>
            </thead>
            <tbody>
              {a.products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    {es.auditoria.emptyProducts}
                  </td>
                </tr>
              ) : (
                a.products.map((p) => {
                  const st = bcgStyle(p.bcg);
                  return (
                    <tr key={p.productId} className="border-b border-slate-100">
                      <td className="max-w-[200px] truncate px-3 py-2 font-semibold text-slate-900 sm:px-4">
                        {p.name}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[0.6rem] font-bold ${st.bg} ${st.border}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-2 py-2 tabular-nums">{p.qtySold.toFixed(0)}</td>
                      <td className="px-2 py-2 tabular-nums font-medium text-emerald-700">{fmtMoney(p.revenue)}</td>
                      <td className="px-2 py-2 tabular-nums text-slate-600">{fmtMoney(p.costTotal)}</td>
                      <td className="px-2 py-2 tabular-nums">{p.marginPct.toFixed(1)} %</td>
                      <td className="px-2 py-2 tabular-nums">{fmtMoney(p.avgLineValue)}</td>
                      <td className="px-2 py-2 tabular-nums text-slate-700">
                        {p.peakHour !== null
                          ? `${formatBusinessHourClock(p.peakHour)} (${tzLabel})`
                          : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1">
                          {trendIcon(p.trend)}
                          <span className="tabular-nums text-[0.65rem] text-slate-600">
                            {p.trendPct > 0 ? "+" : ""}
                            {p.trendPct.toFixed(0)}%
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top / bottom */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-black uppercase text-slate-800">{es.auditoria.topProfit}</h3>
          <ol className="mt-2 space-y-1 text-sm">
            {[...a.products].sort((x, y) => y.profit - x.profit).slice(0, 5).map((p, i) => (
              <li key={p.productId} className="flex justify-between gap-2">
                <span className="text-slate-700">
                  {i + 1}. {p.name}
                </span>
                <span className="shrink-0 font-semibold text-emerald-700">{fmtMoney(p.profit)}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-black uppercase text-slate-800">{es.auditoria.worstProfit}</h3>
          <ol className="mt-2 space-y-1 text-sm">
            {[...a.products].sort((x, y) => x.profit - y.profit).slice(0, 5).map((p, i) => (
              <li key={p.productId} className="flex justify-between gap-2">
                <span className="text-slate-700">
                  {i + 1}. {p.name}
                </span>
                <span className="shrink-0 font-semibold text-rose-700">{fmtMoney(p.profit)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Stack + DB */}
      <section className="rounded-xl border border-slate-200 bg-slate-50/80 shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left sm:px-5"
          onClick={() => setShowStack((v) => !v)}
        >
          <span className="flex items-center gap-2 text-sm font-black uppercase text-slate-800">
            <Database className="h-4 w-4" />
            {es.auditoria.stackTitle}
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 transition ${showStack ? "rotate-180" : ""}`} />
        </button>
        {showStack && (
          <div className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-2 text-sm text-slate-700 sm:px-5">
            <p>{es.auditoria.stackFrontend}</p>
            <p>{es.auditoria.stackBackend}</p>
            <p>{es.auditoria.stackDb}</p>
            <p>{es.auditoria.stackAi}</p>
            <p className="text-xs text-slate-500">{es.auditoria.stackSync}</p>
          </div>
        )}
      </section>
    </div>
  );
}
