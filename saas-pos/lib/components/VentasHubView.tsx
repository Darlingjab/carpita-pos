"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  CreditCard,
  Receipt,
  ShoppingBag,
  Tag,
} from "lucide-react";
import type { RegisterMovement, Sale } from "@/lib/types";
import { es } from "@/lib/locale";
import { RegisterOpenConfirmModal } from "@/lib/components/RegisterOpenConfirmModal";

const SUB_KEY = "pos_ventas_subtab_saas_v2";
const MOV_FILTER_KEY = "pos_ventas_mov_filter_v1";

type SubTab = "reportes" | "movimientos" | "arqueos";
type MovimientoFilter = "todos" | "ventas" | "descuentos" | "gastos";

function fmtDT(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function isTodayEs(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

export function VentasHubView() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [subTab, setSubTab] = useState<SubTab>("movimientos");
  const [movFilter, setMovFilter] = useState<MovimientoFilter>("todos");
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<RegisterMovement[]>([]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState(0);
  const [openFormHasBase, setOpenFormHasBase] = useState(true);
  const [openFormAmount, setOpenFormAmount] = useState("");
  const [closeFormAmount, setCloseFormAmount] = useState("");
  const [openConfirm, setOpenConfirm] = useState<{ amount: number; hasBase: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (tabParam === "arqueos") {
      setSubTab("arqueos");
      return;
    }

    const validFilter = (x: string | null): x is MovimientoFilter =>
      x === "todos" || x === "ventas" || x === "descuentos" || x === "gastos";

    const mfStored = localStorage.getItem(MOV_FILTER_KEY);
    if (validFilter(mfStored)) setMovFilter(mfStored);

    const v2 = localStorage.getItem(SUB_KEY);
    if (v2 && ["reportes", "movimientos", "arqueos"].includes(v2)) {
      setSubTab(v2 as SubTab);
      return;
    }

    const v1 = localStorage.getItem("pos_ventas_subtab_saas_v1");
    if (v1 === "reportes") setSubTab("reportes");
    else if (v1 === "arqueos") setSubTab("arqueos");
    else if (v1 === "ventas") {
      setSubTab("movimientos");
      if (!validFilter(mfStored)) setMovFilter("ventas");
    } else if (v1 === "descuentos") {
      setSubTab("movimientos");
      if (!validFilter(mfStored)) setMovFilter("descuentos");
    } else if (v1 === "movimientos") setSubTab("movimientos");
    else setSubTab("movimientos");
  }, [tabParam]);

  useEffect(() => {
    localStorage.setItem(SUB_KEY, subTab);
  }, [subTab]);

  useEffect(() => {
    localStorage.setItem(MOV_FILTER_KEY, movFilter);
  }, [movFilter]);

  const refreshRegister = () => {
    fetch("/api/register/status")
      .then((r) => r.json())
      .then((d) => {
        setRegisterOpen(!!d.data?.isOpen);
        setOpeningFloat(Number(d.data?.openingFloat) || 0);
      })
      .catch(() => setRegisterOpen(false));
  };

  useEffect(() => {
    refreshRegister();
    window.addEventListener("pos-register-updated", refreshRegister);
    return () => window.removeEventListener("pos-register-updated", refreshRegister);
  }, []);

  useEffect(() => {
    function loadSales() {
      fetch("/api/sales")
        .then((r) => r.json())
        .then((d) => setSales(d.data ?? []))
        .catch(() => setSales([]));
    }
    window.addEventListener("pos-sales-updated", loadSales);
    if (subTab === "movimientos" || subTab === "reportes") loadSales();
    return () => window.removeEventListener("pos-sales-updated", loadSales);
  }, [subTab]);

  useEffect(() => {
    function loadMov() {
      fetch("/api/register/movements")
        .then((r) => r.json())
        .then((d) => setMovements(d.data ?? []))
        .catch(() => setMovements([]));
    }
    window.addEventListener("pos-register-updated", loadMov);
    window.addEventListener("pos-sales-updated", loadMov);
    if (subTab === "movimientos" || subTab === "arqueos") loadMov();
    return () => {
      window.removeEventListener("pos-register-updated", loadMov);
      window.removeEventListener("pos-sales-updated", loadMov);
    };
  }, [subTab]);

  const movementsLastMonth = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return movements
      .filter((m) => new Date(m.createdAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [movements]);

  const expectedRunning = useMemo(
    () =>
      movements.reduce((acc, m) => {
        if (m.type === "close") return acc;
        return acc + (m.type === "out" ? -m.amount : m.amount);
      }, 0),
    [movements],
  );

  function submitOpenRegister() {
    if (registerOpen) {
      window.alert("La caja ya está abierta. Ciérrala antes de abrir un nuevo arqueo.");
      return;
    }
    const amount = openFormHasBase ? Math.max(0, Number(openFormAmount) || 0) : 0;
    setOpenConfirm({ amount, hasBase: openFormHasBase });
  }

  async function confirmOpenRegister(amount: number) {
    const res = await fetch("/api/register/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) {
      window.alert("No se pudo abrir la caja.");
      return;
    }
    window.dispatchEvent(new CustomEvent("pos-register-updated"));
    refreshRegister();
    setOpenFormAmount("");
  }

  async function submitCloseRegister() {
    if (!registerOpen) return;
    const counted = Math.max(0, Number(closeFormAmount) || 0);
    const msg = es.registerConfirm.closeWithCounted.replace(
      "{counted}",
      `$${counted.toFixed(2)}`,
    );
    if (!window.confirm(msg)) return;

    const res = await fetch("/api/register/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: counted }),
    });
    if (!res.ok) {
      window.alert("No se pudo cerrar la caja.");
      return;
    }
    window.dispatchEvent(new CustomEvent("pos-register-updated"));
    refreshRegister();
    setCloseFormAmount("");
  }

  const salesToday = useMemo(() => sales.filter((s) => isTodayEs(s.createdAt)), [sales]);
  const discountsToday = useMemo(
    () => salesToday.filter((s) => (s.discount ?? 0) > 0),
    [salesToday],
  );
  const salesWithDiscount = useMemo(
    () =>
      [...sales]
        .filter((s) => (s.discount ?? 0) > 0)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 80),
    [sales],
  );
  const gastosMovements = useMemo(
    () => movements.filter((m) => m.type === "out"),
    [movements],
  );
  const revenueToday = useMemo(
    () => salesToday.reduce((a, s) => a + s.total, 0),
    [salesToday],
  );
  const avgTicket =
    salesToday.length > 0 ? revenueToday / salesToday.length : 0;
  const topToday = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of salesToday) {
      for (const it of s.items) {
        m.set(it.name, (m.get(it.name) ?? 0) + it.qty);
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [salesToday]);

  const tabs: { key: SubTab; label: string; icon: LucideIcon; badge?: string | null }[] = useMemo(
    () => [
      { key: "reportes", label: "Reportes Pro", icon: BarChart3 },
      { key: "movimientos", label: "Movimientos de caja", icon: CreditCard },
      { key: "arqueos", label: "Arqueos de caja", icon: Archive, badge: registerOpen ? "Abierto" : null },
    ],
    [registerOpen],
  );

  const movFilters: { key: MovimientoFilter; label: string; icon: LucideIcon }[] = useMemo(
    () => [
      { key: "todos", label: "Todos", icon: CreditCard },
      { key: "ventas", label: "Ventas", icon: ShoppingBag },
      { key: "descuentos", label: "Descuentos", icon: Tag },
      { key: "gastos", label: "Gastos", icon: Receipt },
    ],
    [],
  );

  return (
    <div className="full-screen-container rounded-xl border border-slate-200 bg-[#f8fafc] shadow-sm">
      {openConfirm && (
        <RegisterOpenConfirmModal
          amount={openConfirm.amount}
          hasBase={openConfirm.hasBase}
          onCancel={() => setOpenConfirm(null)}
          onConfirm={() => {
            void (async () => {
              const amt = openConfirm.amount;
              setOpenConfirm(null);
              await confirmOpenRegister(amt);
            })();
          }}
        />
      )}
      {!registerOpen && subTab !== "arqueos" && (
        <div
          className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm"
          style={{ backgroundColor: "#fffbeb", borderColor: "#fcd34d", color: "#92400e" }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <strong>Caja cerrada.</strong>
          <span className="hidden sm:inline">No podrás cobrar ni enviar a cocina hasta abrir arqueo.</span>
          <button
            type="button"
            onClick={() => setSubTab("arqueos")}
            className="ml-auto rounded bg-amber-500 px-2 py-1 text-xs font-bold text-white"
          >
            Ir a Arqueos →
          </button>
        </div>
      )}

      <div className="flex shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSubTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide transition-colors sm:text-sm ${
              subTab === tab.key
                ? "border-b-[3px] text-[var(--primary)]"
                : "border-b-[3px] border-transparent text-[var(--text-secondary)]"
            }`}
            style={subTab === tab.key ? { borderBottomColor: "var(--primary)" } : undefined}
          >
            <tab.icon className="h-3.5 w-3.5 shrink-0" />
            {tab.label}
            {tab.badge && (
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[0.6rem] text-white">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {subTab === "movimientos" && (
        <div className="flex shrink-0 flex-wrap gap-2 border-b border-slate-200 bg-slate-50/90 px-3 py-2.5 sm:px-4">
          <span className="flex w-full items-center text-[0.65rem] font-bold uppercase tracking-wide text-slate-500 sm:mr-2 sm:w-auto">
            Ver por tipo
          </span>
          {movFilters.map((f) => {
            const Icon = f.icon;
            const active = movFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setMovFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                  active
                    ? "border-[var(--primary)] bg-white text-[var(--primary)] shadow-sm"
                    : "border-transparent bg-white/60 text-slate-600 hover:border-slate-200 hover:bg-white"
                }`}
                style={active ? { borderColor: "var(--primary)", color: "var(--primary)" } : undefined}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="main-content min-h-[320px] flex-1 overflow-y-auto p-4">
        {subTab === "reportes" && (
          <div className="animate-fade-in space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">{es.reportsPro.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">{es.reportsPro.salesToday}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{salesToday.length}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">{es.reportsPro.revenueToday}</p>
                <p className="mt-2 text-2xl font-black text-emerald-700">${revenueToday.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">{es.reportsPro.avgTicket}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">${avgTicket.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">{es.reportsPro.topSku}</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{topToday ? topToday[0] : "—"}</p>
                {topToday && (
                  <p className="text-xs text-slate-500">
                    {topToday[1]} {es.reports.units}
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
              <p className="text-sm font-bold text-amber-900">{es.reportsPro.discountsToday}</p>
              <p className="mt-1 text-2xl font-black text-amber-800">
                {discountsToday.length} · $
                {discountsToday.reduce((a, s) => a + (s.discount ?? 0), 0).toFixed(2)}
              </p>
            </div>
            {salesToday.length === 0 && (
              <p className="text-center text-slate-500">{es.reportsPro.none}</p>
            )}
            <Link
              href="/finanzas"
              className="inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-50"
            >
              Ver informes detallados →
            </Link>
          </div>
        )}

        {subTab === "movimientos" && (
          <div className="animate-fade-in space-y-3">
            <p className="text-xs text-slate-500">
              {movFilter === "todos" &&
                "Todos los movimientos de caja: aperturas, cierres, entradas por ventas y salidas (gastos)."}
              {movFilter === "ventas" && "Ventas registradas (mismo listado que antes en la pestaña Ventas)."}
              {movFilter === "descuentos" &&
                "Solo tickets con descuento aplicado (importe del descuento y detalle)."}
              {movFilter === "gastos" && "Salidas de efectivo registradas en caja (tipo «out»)."}
            </p>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {(movFilter === "todos" || movFilter === "gastos") && (
                <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
                    onClick={() => window.open("/api/register/movements/export", "_blank")}
                  >
                    Exportar movimientos CSV
                  </button>
                </div>
              )}

              {movFilter === "todos" && (
                <>
                  <table className="w-full border-collapse text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Tipo</th>
                        <th className="px-3 py-3">Monto</th>
                        <th className="px-3 py-3">Nota</th>
                        <th className="px-3 py-3">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id} className="border-b border-slate-100">
                          <td className="px-3 py-2 capitalize">{m.type}</td>
                          <td className="px-3 py-2 font-semibold">${m.amount.toFixed(2)}</td>
                          <td className="px-3 py-2 text-slate-600">{m.note ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">{fmtDT(m.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {movements.length === 0 && (
                    <p className="p-6 text-center text-slate-500">Sin movimientos.</p>
                  )}
                </>
              )}

              {movFilter === "ventas" && (
                <>
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-3">ID</th>
                        <th className="px-3 py-3">Fecha</th>
                        <th className="px-3 py-3">Canal</th>
                        <th className="px-3 py-3">Cliente</th>
                        <th className="px-3 py-3">Mesero</th>
                        <th className="px-3 py-3">Mesa</th>
                        <th className="px-3 py-3">Dto.</th>
                        <th className="px-3 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.slice(0, 80).map((s) => (
                        <tr key={s.id} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-mono text-xs text-slate-500">{s.id}</td>
                          <td className="px-3 py-2">{fmtDT(s.createdAt)}</td>
                          <td className="px-3 py-2 capitalize">{s.channel}</td>
                          <td className="max-w-[120px] truncate px-3 py-2 text-slate-600" title={s.customerName ?? ""}>
                            {s.customerName ?? "—"}
                          </td>
                          <td className="max-w-[100px] truncate px-3 py-2 text-slate-600" title={s.serverName ?? ""}>
                            {s.serverName ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{s.tableId ?? "—"}</td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-xs text-slate-600">
                            {(s.discount ?? 0) > 0
                              ? `${s.discountType ?? ""} ${s.discountPercent != null ? `${s.discountPercent}%` : ""} ${s.discountDescription ?? ""}`.trim() ||
                                `−$${s.discount.toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700">${s.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sales.length === 0 && (
                    <p className="p-8 text-center text-slate-500">Sin ventas en memoria.</p>
                  )}
                </>
              )}

              {movFilter === "descuentos" && (
                <>
                  <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                      <tr>
                        {es.ventasDiscounts.cols.map((h) => (
                          <th key={h} className="px-3 py-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {salesWithDiscount.map((s) => (
                        <tr key={s.id} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-mono text-xs">{s.id}</td>
                          <td className="px-3 py-2">{fmtDT(s.createdAt)}</td>
                          <td className="px-3 py-2 capitalize">{s.discountType ?? "—"}</td>
                          <td className="max-w-[160px] truncate px-3 py-2" title={s.discountDescription ?? ""}>
                            {s.discountDescription ?? "—"}
                          </td>
                          <td className="px-3 py-2">{s.discountPercent != null ? `${s.discountPercent}%` : "—"}</td>
                          <td className="px-3 py-2 font-semibold text-rose-700">−${(s.discount ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-bold">${s.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {salesWithDiscount.length === 0 && (
                    <p className="p-8 text-center text-slate-500">Sin ventas con descuento.</p>
                  )}
                </>
              )}

              {movFilter === "gastos" && (
                <>
                  <table className="w-full border-collapse text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Tipo</th>
                        <th className="px-3 py-3">Monto</th>
                        <th className="px-3 py-3">Nota</th>
                        <th className="px-3 py-3">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gastosMovements.map((m) => (
                        <tr key={m.id} className="border-b border-slate-100">
                          <td className="px-3 py-2 capitalize">{m.type}</td>
                          <td className="px-3 py-2 font-semibold text-rose-700">−${m.amount.toFixed(2)}</td>
                          <td className="px-3 py-2 text-slate-600">{m.note ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">{fmtDT(m.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {gastosMovements.length === 0 && (
                    <p className="p-6 text-center text-slate-500">Sin salidas de caja (gastos).</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {subTab === "arqueos" && (
          <div className="animate-fade-in space-y-6">
            <p className="text-xs text-slate-500">{es.arqueosHub.registerRedirectNote}</p>
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
                onClick={() => window.open("/api/register/movements/export", "_blank")}
              >
                Exportar arqueos CSV
              </button>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">{es.arqueosHub.sectionOperations}</h2>
                <p className="mt-2 text-sm text-slate-700">
                  Estado:{" "}
                  <strong className={registerOpen ? "text-emerald-700" : "text-rose-600"}>
                    {registerOpen
                      ? `Caja abierta (última base declarada $${openingFloat.toFixed(2)})`
                      : "Caja cerrada"}
                  </strong>
                </p>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-800">{es.register.title}</h3>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={openFormHasBase}
                      onChange={(e) => setOpenFormHasBase(e.target.checked)}
                      disabled={registerOpen}
                    />
                    ¿Inicias con dinero de base en caja?
                  </label>
                  {openFormHasBase && (
                    <>
                      <label className="mt-2 block text-xs font-bold uppercase text-slate-500">
                        {es.register.openingAmount}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                        value={openFormAmount}
                        onChange={(e) => setOpenFormAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={registerOpen}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => void submitOpenRegister()}
                    disabled={registerOpen}
                    className="btn-pos-primary mt-4 w-full py-2.5 text-sm font-extrabold uppercase text-white disabled:opacity-45"
                  >
                    {es.register.open}
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-800">{es.register.closingTitle}</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {es.register.expected}: ${expectedRunning.toFixed(2)}
                  </p>
                  <label className="mt-3 block text-xs font-bold uppercase text-slate-500">
                    {es.register.closingAmount}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
                    value={closeFormAmount}
                    onChange={(e) => setCloseFormAmount(e.target.value)}
                    disabled={!registerOpen}
                  />
                  {registerOpen && closeFormAmount !== "" && (
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {es.register.difference}: $
                      {((Number(closeFormAmount) || 0) - expectedRunning).toFixed(2)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">{es.arqueosHub.closeOnlyWhenOpen}</p>
                  <button
                    type="button"
                    onClick={() => void submitCloseRegister()}
                    disabled={!registerOpen}
                    className="mt-3 w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-extrabold uppercase text-slate-800 disabled:opacity-45"
                  >
                    {es.register.close}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">{es.arqueosHub.sectionHistory}</h2>
                <p className="mt-1 text-xs text-slate-500">{es.arqueosHub.historyHint}</p>
                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2 text-right">Monto</th>
                        <th className="px-3 py-2">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movementsLastMonth.map((m) => (
                        <tr key={m.id} className="border-b border-slate-100">
                          <td className="whitespace-nowrap px-3 py-2 text-xs">{fmtDT(m.createdAt)}</td>
                          <td className="px-3 py-2 capitalize">{m.type}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">${m.amount.toFixed(2)}</td>
                          <td className="max-w-[220px] truncate px-3 py-2 text-xs text-slate-600" title={m.note ?? ""}>
                            {m.note ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {movementsLastMonth.length === 0 && (
                  <p className="mt-4 text-center text-sm text-slate-500">Sin movimientos en los últimos 30 días.</p>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
