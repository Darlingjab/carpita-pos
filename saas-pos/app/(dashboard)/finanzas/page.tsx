"use client";

import { useEffect, useMemo, useState } from "react";
import { es } from "@/lib/locale";
import { importedSalesStats } from "@/lib/data/imported-sales-stats";
import { importedSalesSeed } from "@/lib/data/imported-sales-sample";
import type { KitchenTicket, RegisterMovement, Sale } from "@/lib/types";
import { ExportCsvPeriodLinks } from "@/lib/components/ExportCsvPeriodLinks";

function currency(n: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n);
}

function integer(n: number) {
  return new Intl.NumberFormat("es-EC").format(n);
}

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDayMs(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.getTime();
}

function endOfDayMs(dateStr: string) {
  const d = new Date(`${dateStr}T23:59:59.999`);
  return d.getTime();
}

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function salePaymentsLabel(s: Sale): string {
  const rows = s.payments ?? [];
  if (rows.length === 0) return "—";
  return rows
    .map((p) => {
      const tag =
        p.method === "cash" ? "Efe" : p.method === "card" ? "Tarj" : "Transf";
      return `${tag} ${currency(p.amount)}`;
    })
    .join(" · ");
}

export default function FinanzasInformesPage() {
  const historic = importedSalesStats;
  const [source, setSource] = useState<"imported" | "session">("imported");
  const [sales, setSales] = useState<Sale[]>([]);
  const [kitchenTickets, setKitchenTickets] = useState<KitchenTicket[]>([]);
  const [movements, setMovements] = useState<RegisterMovement[]>([]);

  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => toDateInputValue(today));
  const [to, setTo] = useState(() => toDateInputValue(today));
  const [quickRange, setQuickRange] = useState<
    "day" | "7" | "15" | "30" | "week" | "year" | "custom"
  >("day");
  const [serverFilter, setServerFilter] = useState<string>("all");

  const loadData = () => {
    fetch("/api/sales")
      .then((r) => r.json())
      .then((d) => setSales(Array.isArray(d.data) ? d.data : []))
      .catch(() => setSales([]));
    fetch("/api/kitchen/tickets")
      .then((r) => r.json())
      .then((d) => setKitchenTickets(d.data ?? []))
      .catch(() => setKitchenTickets([]));
    fetch("/api/register/movements")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((d) => setMovements(Array.isArray(d.data) ? d.data : []))
      .catch(() => setMovements([]));
  };

  useEffect(() => {
    loadData();
    // Refrescar cuando se registre un gasto o venta
    window.addEventListener("pos-register-updated", loadData);
    window.addEventListener("pos-sales-updated", loadData);
    return () => {
      window.removeEventListener("pos-register-updated", loadData);
      window.removeEventListener("pos-sales-updated", loadData);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importedSaleIds = useMemo(() => new Set(importedSalesSeed.map((s) => s.id)), []);

  const sourceSales = useMemo(() => {
    if (source === "imported") return importedSalesSeed;
    return sales.filter((s) => !importedSaleIds.has(s.id));
  }, [source, sales, importedSaleIds]);

  function applyRange(days: number) {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    setFrom(toDateInputValue(start));
    setTo(toDateInputValue(end));
  }

  function applyThisWeek() {
    const end = new Date();
    setFrom(toDateInputValue(startOfWeekMonday(end)));
    setTo(toDateInputValue(end));
  }

  function applyThisYear() {
    const end = new Date();
    setFrom(toDateInputValue(new Date(end.getFullYear(), 0, 1)));
    setTo(toDateInputValue(end));
  }

  const filtered = useMemo(() => {
    const fromMs = startOfDayMs(from);
    const toMs = endOfDayMs(to);
    return sourceSales.filter((s) => {
      const ms = new Date(s.createdAt).getTime();
      if (!Number.isFinite(ms) || ms < fromMs || ms > toMs) return false;
      if (serverFilter === "all") return true;
      return (s.serverName ?? "—") === serverFilter;
    });
  }, [sourceSales, from, to, serverFilter]);

  const serverOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of sourceSales) {
      set.add(s.serverName ?? "—");
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [sourceSales]);

  const revenue = useMemo(() => filtered.reduce((a, s) => a + s.total, 0), [filtered]);
  const discounts = useMemo(() => filtered.reduce((a, s) => a + (s.discount ?? 0), 0), [filtered]);
  const count = filtered.length;
  const avgTicket = count > 0 ? revenue / count : 0;

  // Gastos del período (movements tipo "out" en el rango de fechas seleccionado)
  const filteredGastos = useMemo(() => {
    const fromMs = startOfDayMs(from);
    const toMs = endOfDayMs(to);
    return movements.filter((m) => {
      if (m.type !== "out") return false;
      const ms = new Date(m.createdAt).getTime();
      return Number.isFinite(ms) && ms >= fromMs && ms <= toMs;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [movements, from, to]);

  const totalGastos = useMemo(() => filteredGastos.reduce((a, m) => a + m.amount, 0), [filteredGastos]);
  const balanceNeto = revenue - totalGastos;

  // Gastos agrupados por categoría (extrae "[Categoria] concepto")
  const gastosByCategoria = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of filteredGastos) {
      const match = (m.note ?? "").match(/^\[([^\]]+)\]/);
      const cat = match?.[1] ?? "Otro";
      map.set(cat, (map.get(cat) ?? 0) + m.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredGastos]);

  const byPayment = useMemo(() => {
    const sumMethod = (method: "cash" | "card" | "transfer") =>
      filtered.reduce(
        (a, s) =>
          a + (s.payments?.filter((p) => p.method === method).reduce((x, p) => x + p.amount, 0) ?? 0),
        0,
      );
    const cash = sumMethod("cash");
    const card = sumMethod("card");
    const transfer = sumMethod("transfer");
    return { cash, card, transfer };
  }, [filtered]);

  const paymentsSum = byPayment.cash + byPayment.card + byPayment.transfer;
  const paymentsMatchRevenue = Math.abs(paymentsSum - revenue) < 0.05;

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    for (const s of filtered) {
      for (const it of s.items) {
        const cur = map.get(it.productId) ?? { name: it.name, qty: 0 };
        cur.qty += it.qty;
        map.set(it.productId, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [filtered]);

  const dailyKitchen = useMemo(() => {
    const nowMs = Date.now();
    const fromMs = startOfDayMs(from);
    const toMs = endOfDayMs(to);
    const rows = kitchenTickets
      .map((t) => {
      const createdMs = new Date(t.createdAt).getTime();
        if (!Number.isFinite(createdMs) || createdMs < fromMs || createdMs > toMs) return null;
      if (serverFilter !== "all") {
        const sale = sales.find((s) => s.tableId === t.tableId && Math.abs(new Date(s.createdAt).getTime() - createdMs) < 4 * 60 * 60 * 1000);
        if ((sale?.serverName ?? "—") !== serverFilter) return null;
      }
        const endMs = t.readyAt ? new Date(t.readyAt).getTime() : nowMs;
        const prepMin = Math.max(0, Math.floor((endMs - createdMs) / 60000));
        return {
          id: t.id,
          label: t.tableLabel ?? t.tableId ?? "Mostrador",
          createdAt: t.createdAt,
          readyAt: t.readyAt ?? null,
          prepMin,
          delayed: prepMin > 10,
          status: t.status,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    const delays = rows.filter((r) => r.delayed);
    const avgPrep = rows.length > 0 ? rows.reduce((n, r) => n + r.prepMin, 0) / rows.length : 0;
    return { rows, delays, avgPrep };
  }, [kitchenTickets, from, to, serverFilter, sales]);

  const delayRanking = useMemo(() => {
    const map = new Map<string, { label: string; delayed: number; avgDelay: number; totalDelay: number }>();
    for (const d of dailyKitchen.delays) {
      const key = d.label || "Mesa";
      const ex = map.get(key) ?? { label: key, delayed: 0, avgDelay: 0, totalDelay: 0 };
      ex.delayed += 1;
      ex.totalDelay += d.prepMin;
      map.set(key, ex);
    }
    return [...map.values()]
      .map((r) => ({ ...r, avgDelay: r.delayed > 0 ? r.totalDelay / r.delayed : 0 }))
      .sort((a, b) => b.delayed - a.delayed || b.avgDelay - a.avgDelay)
      .slice(0, 10);
  }, [dailyKitchen.delays]);

  const salesExportExtra = useMemo(() => {
    const e: Record<string, string> = { source };
    if (serverFilter !== "all") e.server = serverFilter;
    return e;
  }, [source, serverFilter]);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Finanzas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Informes, exportaciones y totales; filtra ventas por fechas y mesero.
        </p>
      </div>

      <div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold uppercase text-slate-800">Filtro de fechas</h2>
              <p className="mt-1 text-xs text-slate-500">
                Datos:{" "}
                <strong className="text-slate-700">
                  {source === "imported" ? "Importados (documentos)" : "Sesión actual"}
                </strong>
                {source === "imported" && (
                  <span className="text-slate-500"> · {historic.transactionCount.toLocaleString("es-EC")} ventas históricas</span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="mr-2 inline-flex overflow-hidden rounded-full border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setSource("imported")}
                  className={`px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide ${
                    source === "imported"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Importado
                </button>
                <button
                  type="button"
                  onClick={() => setSource("session")}
                  className={`px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide ${
                    source === "session"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Sesión
                </button>
              </div>
              {(
                [
                  { key: "day" as const, label: "Hoy", days: 1 },
                  { key: "7" as const, label: "7 días", days: 7 },
                  { key: "15" as const, label: "15 días", days: 15 },
                  { key: "30" as const, label: "30 días", days: 30 },
                ] as const
              ).map((b) => {
                const active = quickRange === b.key;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => {
                      setQuickRange(b.key);
                      applyRange(b.days);
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide transition ${
                      active
                        ? "bg-[var(--pos-primary)] text-white shadow"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {b.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setQuickRange("week");
                  applyThisWeek();
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide transition ${
                  quickRange === "week"
                    ? "bg-[var(--pos-primary)] text-white shadow"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Esta semana
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickRange("year");
                  applyThisYear();
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide transition ${
                  quickRange === "year"
                    ? "bg-[var(--pos-primary)] text-white shadow"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Este año
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500">Desde</label>
              <input
                className="input-base mt-1 w-full text-sm"
                type="date"
                value={from}
                onChange={(e) => {
                  setQuickRange("custom");
                  setFrom(e.target.value);
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500">Hasta</label>
              <input
                className="input-base mt-1 w-full text-sm"
                type="date"
                value={to}
                onChange={(e) => {
                  setQuickRange("custom");
                  setTo(e.target.value);
                }}
              />
            </div>
            <div className="flex items-end justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="font-bold text-slate-700">Rango</span>
              <span className="font-mono text-slate-600">
                {from} → {to}
              </span>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500">Mesero</label>
              <select
                className="input-base mt-1 w-full text-sm"
                value={serverFilter}
                onChange={(e) => setServerFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                {serverOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <ExportCsvPeriodLinks
              hrefBase="/api/sales/export"
              label="Exportar CSV"
              extraParams={{ ...salesExportExtra, format: "csv" }}
              pickerRange={{ from, to }}
            />
            <ExportCsvPeriodLinks
              hrefBase="/api/sales/export"
              label="Exportar PDF"
              extraParams={{ ...salesExportExtra, format: "pdf" }}
              pickerRange={{ from, to }}
            />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Ventas (rango seleccionado)</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Transacciones</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{integer(count)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Ingresos</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">{currency(revenue)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Descuentos</p>
            <p className="mt-1 text-2xl font-black text-amber-700">{currency(discounts)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Ticket promedio</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{currency(avgTicket)}</p>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-extrabold uppercase text-slate-700">Cobros por medio de pago</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Suma de líneas registradas en cada venta (efectivo, tarjeta, transferencia). Respeta el filtro de
            fechas y mesero.
          </p>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Efectivo</p>
            <p className="mt-1 text-xl font-black text-slate-900">{currency(byPayment.cash)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Tarjeta</p>
            <p className="mt-1 text-xl font-black text-slate-900">{currency(byPayment.card)}</p>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-violet-800">Transferencia</p>
            <p className="mt-1 text-xl font-black text-violet-950">{currency(byPayment.transfer)}</p>
          </div>
          <div
            className={`rounded-lg border p-4 shadow-sm ${
              paymentsMatchRevenue
                ? "border-emerald-200 bg-emerald-50/40"
                : "border-amber-200 bg-amber-50/40"
            }`}
          >
            <p className="text-xs font-bold uppercase text-slate-600">Suma medios</p>
            <p className="mt-1 text-xl font-black text-slate-900">{currency(paymentsSum)}</p>
            <p className="mt-1 text-[0.65rem] font-semibold text-slate-600">
              {paymentsMatchRevenue
                ? "Coincide con ingresos del rango"
                : "Diferencia vs ingresos: revisa ventas sin desglose o datos antiguos"}
            </p>
          </div>
        </div>

        {/* ── Gastos del período + Balance neto ─────────────────────────── */}
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold uppercase text-rose-900">Gastos del período</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Salidas de caja registradas en Gastos dentro del rango de fechas.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-right">
                <p className="text-[0.65rem] font-bold uppercase text-rose-700">Total gastos</p>
                <p className="text-xl font-black text-rose-700">{currency(totalGastos)}</p>
              </div>
              <div className={`rounded-lg border px-4 py-2 text-right ${balanceNeto >= 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-300 bg-rose-100"}`}>
                <p className="text-[0.65rem] font-bold uppercase text-slate-600">Balance neto</p>
                <p className={`text-xl font-black ${balanceNeto >= 0 ? "text-emerald-700" : "text-rose-800"}`}>
                  {currency(balanceNeto)}
                </p>
                <p className="text-[0.6rem] text-slate-500">ingresos − gastos</p>
              </div>
            </div>
          </div>

          {gastosByCategoria.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {gastosByCategoria.map(([cat, total]) => (
                <span key={cat} className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-bold text-rose-800">
                  {cat}: {currency(total)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Sin gastos registrados en este período. Añadí gastos desde la pestaña <strong>Gastos</strong>.
            </p>
          )}

          {filteredGastos.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border border-rose-100">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-rose-100/60 text-xs font-bold uppercase text-rose-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Categoría</th>
                    <th className="px-3 py-2 text-left">Concepto</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-left">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGastos.map((m) => {
                    const match = (m.note ?? "").match(/^\[([^\]]+)\] (.+)$/);
                    const cat = match?.[1] ?? "—";
                    const concepto = match?.[2] ?? (m.note ?? "—");
                    return (
                      <tr key={m.id} className="border-t border-rose-100 hover:bg-rose-50/40">
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">{cat}</span>
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2 text-slate-700">{concepto}</td>
                        <td className="px-3 py-2 text-right font-bold text-rose-700">{currency(m.amount)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                          {new Date(m.createdAt).toLocaleString("es-EC", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">{es.reports.topMemory}</p>
            <p className="mt-1 text-xs text-slate-500">Top productos por cantidad</p>
            <ul className="mt-2 space-y-1 text-sm">
              {topProducts.slice(0, 5).map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-slate-800">{p.name}</span>
                  <span className="shrink-0 font-black tabular-nums text-slate-700">{p.qty}</span>
                </li>
              ))}
              {topProducts.length === 0 && <li className="text-sm text-slate-500">—</li>}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Cocina diaria</p>
            <p className="mt-1 text-xl font-black text-slate-900">
              {integer(dailyKitchen.rows.length)} tickets
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Promedio preparación: {dailyKitchen.avgPrep.toFixed(1)} min
            </p>
            <p className="mt-1 text-xs font-bold text-red-700">
              Demoras (&gt;10 min): {integer(dailyKitchen.delays.length)}
            </p>
          </div>
        </div>

        {dailyKitchen.delays.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-red-200 bg-white p-4">
            <p className="text-sm font-bold text-red-800">Historial de demoras de cocina</p>
            <table className="mt-2 w-full min-w-[560px] border-collapse text-left text-sm">
              <thead className="border-b border-red-100 bg-red-50 text-xs font-semibold uppercase text-red-700">
                <tr>
                  <th className="px-2 py-2">Orden</th>
                  <th className="px-2 py-2">Inicio</th>
                  <th className="px-2 py-2">Fin</th>
                  <th className="px-2 py-2 text-right">Minutos</th>
                  <th className="px-2 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {dailyKitchen.delays.slice(0, 100).map((d) => (
                  <tr key={d.id} className="border-b border-zinc-100">
                    <td className="px-2 py-1.5 font-semibold">{d.label}</td>
                    <td className="px-2 py-1.5 text-xs text-zinc-600">{new Date(d.createdAt).toLocaleString("es-EC")}</td>
                    <td className="px-2 py-1.5 text-xs text-zinc-600">{d.readyAt ? new Date(d.readyAt).toLocaleString("es-EC") : "En curso"}</td>
                    <td className="px-2 py-1.5 text-right font-black text-red-700">{d.prepMin}</td>
                    <td className="px-2 py-1.5 text-xs">{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {delayRanking.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4">
            <p className="text-sm font-bold text-amber-800">Ranking de mesas con más demoras</p>
            <ul className="mt-2 space-y-1 text-sm">
              {delayRanking.map((r, idx) => (
                <li key={r.label} className="flex items-center justify-between rounded border border-amber-100 bg-amber-50/40 px-2 py-1">
                  <span className="font-semibold text-slate-800">
                    #{idx + 1} {r.label}
                  </span>
                  <span className="text-xs font-bold text-amber-900">
                    {r.delayed} demoras · prom {r.avgDelay.toFixed(1)} min
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-bold text-slate-800">Ventas (detalle)</p>
            <table className="mt-3 w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className="px-2 py-2">{es.reports.thCustomer}</th>
                  <th className="px-2 py-2">{es.reports.thServer}</th>
                  <th className="px-2 py-2">{es.reports.thTable}</th>
                  <th className="px-2 py-2">Descuento</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="min-w-[160px] px-2 py-2">Pagos</th>
                  <th className="px-2 py-2">Fecha</th>
                </tr>
              </thead>
              {filtered.length > 50 && (
                <caption className="caption-bottom px-2 py-1.5 text-left text-xs text-slate-500">
                  Mostrando las primeras 50 de {filtered.length.toLocaleString("es-EC")} ventas. Descargá el CSV para ver todas.
                </caption>
              )}
              <tbody>
                {filtered.slice(0, 50).map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100">
                    <td className="max-w-[140px] truncate px-2 py-1.5">{s.customerName ?? "—"}</td>
                    <td className="max-w-[120px] truncate px-2 py-1.5">{s.serverName ?? "—"}</td>
                    <td className="px-2 py-1.5 text-zinc-600">{s.tableId ?? "—"}</td>
                    <td className="max-w-[120px] truncate px-2 py-1.5 text-xs">
                      {(s.discount ?? 0) > 0
                        ? `${s.discountType ?? ""} ${s.discountDescription ?? ""} −$${s.discount.toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold">{currency(s.total)}</td>
                    <td className="max-w-[220px] px-2 py-1.5 text-xs font-medium text-slate-700">
                      {salePaymentsLabel(s)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs text-zinc-500">
                      {new Date(s.createdAt).toLocaleString("es-EC")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
