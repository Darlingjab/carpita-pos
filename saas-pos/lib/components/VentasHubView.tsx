"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Archive,
  Ban,
  BarChart3,
  CircleDollarSign,
  CreditCard,
  Receipt,
  ShoppingBag,
  Tag,
} from "lucide-react";
import type { AppUser, RegisterMovement, Sale } from "@/lib/types";
import { es } from "@/lib/locale";
import { RegisterOpenConfirmModal } from "@/lib/components/RegisterOpenConfirmModal";
import { expectedRegisterCash, registerMovementCashDelta } from "@/lib/register-balance";
import { importedSalesStats } from "@/lib/data/imported-sales-stats";
import { importedSalesSeed } from "@/lib/data/imported-sales-sample";
import { salesToImportedRegisterMovements } from "@/lib/import-sales-movements";
import { ExportCsvPeriodLinks } from "@/lib/components/ExportCsvPeriodLinks";

/** Evita renderizar decenas de miles de filas en el DOM; el CSV lleva el total filtrado. */
const IMPORT_MOV_UI_CAP = 500;

const SUB_KEY = "pos_ventas_subtab_saas_v2";
const MOV_FILTER_KEY = "pos_ventas_mov_filter_v1";

type SubTab = "reportes" | "movimientos" | "arqueos";
type MovimientoFilter = "todos" | "ventas" | "descuentos" | "gastos";
type ArqueosHistorySource = "pos" | "import";

type RegisterMonthImportRow = {
  tickets: number;
  revenue: number;
  cash: number;
  card: number;
  transfer: number;
};

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

function monthKeyFromIso(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function formatMonthLabel(ym: string): string {
  const parts = ym.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  if (!y || !mo) return ym;
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleDateString("es-EC", { month: "long", year: "numeric" });
}

function movementTypeLabel(type: RegisterMovement["type"]): string {
  const labels = es.arqueosHub.movementTypes;
  return labels[type as keyof typeof labels] ?? type;
}

export function VentasHubView() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [subTab, setSubTab] = useState<SubTab>("movimientos");
  const [movFilter, setMovFilter] = useState<MovimientoFilter>("todos");
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<RegisterMovement[]>([]);
  const [registerOpen, setRegisterOpen] = useState<boolean | null>(null);
  const [openingFloat, setOpeningFloat] = useState(0);
  const [openFormHasBase, setOpenFormHasBase] = useState(true);
  const [openFormAmount, setOpenFormAmount] = useState("");
  const [closeFormAmount, setCloseFormAmount] = useState("");
  const [openConfirm, setOpenConfirm] = useState<{ amount: number; hasBase: boolean } | null>(
    null,
  );
  const [me, setMe] = useState<AppUser | null>(null);
  const [arqueosMonthKey, setArqueosMonthKey] = useState<string>("all");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [arqueosBusy, setArqueosBusy] = useState(false);
  const [arqueosHistorySource, setArqueosHistorySource] = useState<ArqueosHistorySource>("import");
  const [movSearch, setMovSearch] = useState("");
  const [arqueosQuickFilter, setArqueosQuickFilter] = useState<"today" | "7d" | "30d" | "month" | "all">("7d");

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

  useEffect(() => {
    if (subTab !== "arqueos") return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.data ?? null))
      .catch(() => setMe(null));
  }, [subTab]);

  const movementsLastMonth = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return movements
      .filter((m) => new Date(m.createdAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [movements]);

  const expectedRunning = useMemo(() => expectedRegisterCash(movements), [movements]);

  const voidedMovementIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of movements) {
      if (m.type === "adjustment" && m.voidsMovementId) s.add(m.voidsMovementId);
    }
    return s;
  }, [movements]);

  const importMovements = useMemo(
    () => salesToImportedRegisterMovements(importedSalesSeed),
    [],
  );

  const importSalesSorted = useMemo(
    () =>
      [...importedSalesSeed].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [],
  );

  const salesWithDiscountImport = useMemo(
    () => importSalesSorted.filter((s) => (s.discount ?? 0) > 0),
    [importSalesSorted],
  );

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const m of movements) {
      const k = monthKeyFromIso(m.createdAt);
      if (k) keys.add(k);
    }
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [movements]);

  const arqueosFiltered = useMemo(() => {
    const now = Date.now();
    const list = [...movements].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    // Apply quick filter for POS source
    const quickFiltered = (() => {
      if (arqueosQuickFilter === "all") return list;
      if (arqueosQuickFilter === "today") {
        const todayStr = new Date().toDateString();
        return list.filter((m) => new Date(m.createdAt).toDateString() === todayStr);
      }
      if (arqueosQuickFilter === "7d") return list.filter((m) => now - new Date(m.createdAt).getTime() <= 7 * 86400000);
      if (arqueosQuickFilter === "30d") return list.filter((m) => now - new Date(m.createdAt).getTime() <= 30 * 86400000);
      if (arqueosQuickFilter === "month") {
        const cur = monthKeyFromIso(new Date().toISOString());
        return list.filter((m) => monthKeyFromIso(m.createdAt) === cur);
      }
      return list;
    })();
    if (arqueosMonthKey === "all") return quickFiltered;
    return quickFiltered.filter((m) => monthKeyFromIso(m.createdAt) === arqueosMonthKey);
  }, [movements, arqueosMonthKey, arqueosQuickFilter]);

  const monthCashSum = useMemo(
    () => arqueosFiltered.reduce((acc, m) => acc + registerMovementCashDelta(m), 0),
    [arqueosFiltered],
  );

  const canAdminRegister = me?.role === "admin";

  const registerMonthlyFromImport = useMemo((): Record<string, RegisterMonthImportRow> => {
    const raw = (
      importedSalesStats as {
        registerMonthlyFromImport?: Record<string, RegisterMonthImportRow>;
      }
    ).registerMonthlyFromImport;
    return raw && typeof raw === "object" ? raw : {};
  }, []);

  const importMonthOptions = useMemo(
    () => Object.keys(registerMonthlyFromImport).sort((a, b) => b.localeCompare(a)),
    [registerMonthlyFromImport],
  );

  useEffect(() => {
    if (arqueosHistorySource === "import") {
      if (arqueosMonthKey !== "all" && !importMonthOptions.includes(arqueosMonthKey)) {
        setArqueosMonthKey("all");
      }
      return;
    }
    if (arqueosMonthKey !== "all" && !monthOptions.includes(arqueosMonthKey)) {
      setArqueosMonthKey("all");
    }
  }, [arqueosHistorySource, arqueosMonthKey, importMonthOptions, monthOptions]);

  const arqueosImportRows = useMemo(() => {
    const keys =
      arqueosMonthKey === "all"
        ? importMonthOptions
        : importMonthOptions.includes(arqueosMonthKey)
          ? [arqueosMonthKey]
          : [];
    return keys.map((ym) => ({ ym, row: registerMonthlyFromImport[ym]! }));
  }, [arqueosMonthKey, importMonthOptions, registerMonthlyFromImport]);

  const importScopeTotals = useMemo(() => {
    let tickets = 0;
    let revenue = 0;
    let cash = 0;
    let card = 0;
    let transfer = 0;
    for (const { row } of arqueosImportRows) {
      if (!row) continue;
      tickets += row.tickets;
      revenue += row.revenue;
      cash += row.cash;
      card += row.card;
      transfer += row.transfer;
    }
    return { tickets, revenue, cash, card, transfer };
  }, [arqueosImportRows]);

  async function submitVoidMovement(targetId: string) {
    if (!canAdminRegister) return;
    if (!window.confirm(es.arqueosHub.voidConfirm)) return;
    setArqueosBusy(true);
    try {
      const res = await fetch("/api/register/movements/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(
          data?.message ??
            data?.error ??
            (data?.error === "cloud_sync_failed"
              ? `No se guardó en Supabase: ${String(data?.detail ?? "")}`
              : "No se pudo anular el movimiento."),
        );
        return;
      }
      window.dispatchEvent(new CustomEvent("pos-register-updated"));
    } finally {
      setArqueosBusy(false);
    }
  }

  async function submitManualAdjust() {
    if (!canAdminRegister) return;
    const amount = Number(adjustAmount);
    const note = adjustNote.trim();
    if (!Number.isFinite(amount) || amount === 0) {
      window.alert("Indique un monto distinto de cero.");
      return;
    }
    if (note.length < 3) {
      window.alert("Indique el motivo del ajuste (mín. 3 caracteres).");
      return;
    }
    setArqueosBusy(true);
    try {
      const res = await fetch("/api/register/movements/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(
          data?.message ??
            (data?.error === "cloud_sync_failed"
              ? `No se guardó en Supabase: ${String(data?.detail ?? "")}`
              : "No se pudo registrar el ajuste."),
        );
        return;
      }
      setAdjustAmount("");
      setAdjustNote("");
      window.dispatchEvent(new CustomEvent("pos-register-updated"));
    } finally {
      setArqueosBusy(false);
    }
  }

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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(
        data?.error === "cloud_sync_failed"
          ? `No se guardó en Supabase: ${String(data?.detail ?? "")}. Revisa la tabla pos_runtime_state y las variables de entorno.`
          : "No se pudo abrir la caja.",
      );
      return;
    }
    window.dispatchEvent(new CustomEvent("pos-register-updated"));
    refreshRegister();
    setOpenFormAmount("");
  }

  async function submitCloseRegister() {
    if (!registerOpen) return;
    const counted = Math.max(0, Number(closeFormAmount) || 0);

    // Verificar mesas abiertas antes de cerrar
    let openTablesCount = 0;
    try {
      const r = await fetch("/api/tables/assignments");
      if (r.ok) {
        const d = (await r.json()) as { data?: Record<string, unknown> };
        openTablesCount = Object.keys(d.data ?? {}).length;
      }
    } catch {
      // si falla el check, continuamos sin bloquear
    }

    let msg = es.registerConfirm.closeWithCounted.replace("{counted}", `$${counted.toFixed(2)}`);
    if (openTablesCount > 0) {
      msg =
        `⚠️ Hay ${openTablesCount} mesa${openTablesCount > 1 ? "s" : ""} aún ocupada${openTablesCount > 1 ? "s" : ""}.\n\n` +
        `Si es cambio de turno, podés cerrar la caja igualmente — las mesas seguirán activas para el siguiente turno y el cajero que las cobre podrá abrir una nueva caja.\n\n` +
        `Efectivo contado: $${counted.toFixed(2)}\n\n` +
        `¿Cerrar caja de todas formas?`;
    }
    if (!window.confirm(msg)) return;

    const res = await fetch("/api/register/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: counted }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(
        data?.error === "cloud_sync_failed"
          ? `No se guardó en Supabase: ${String(data?.detail ?? "")}. Revisa la tabla pos_runtime_state y las variables de entorno.`
          : "No se pudo cerrar la caja.",
      );
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
      { key: "reportes", label: "Resumen", icon: BarChart3 },
      { key: "movimientos", label: "Movimientos de caja", icon: CreditCard },
      { key: "arqueos", label: "Arqueos de caja", icon: Archive, badge: registerOpen === true ? "Abierto" : null },
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
      {registerOpen === false && subTab !== "arqueos" && (
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
            className="ml-auto rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-600"
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
              <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-blue-400" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{es.reportsPro.salesToday}</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">{salesToday.length}</p>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-emerald-400" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{es.reportsPro.revenueToday}</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-emerald-700">${revenueToday.toFixed(2)}</p>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-violet-400" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{es.reportsPro.avgTicket}</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">${avgTicket.toFixed(2)}</p>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-amber-400" />
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{es.reportsPro.topSku}</p>
                <p className="mt-2 text-base font-bold text-slate-900">{topToday ? topToday[0] : "—"}</p>
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
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-3 shadow-sm">
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-emerald-400" />
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-emerald-600">Ingresos hoy</p>
                <p className="mt-1.5 text-2xl font-black tabular-nums text-emerald-800">${revenueToday.toFixed(2)}</p>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-blue-400" />
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">Ventas hoy</p>
                <p className="mt-1.5 text-2xl font-black tabular-nums text-slate-800">{salesToday.length}</p>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-violet-400" />
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">Ticket promedio</p>
                <p className="mt-1.5 text-2xl font-black tabular-nums text-slate-800">${avgTicket.toFixed(2)}</p>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-amber-400" />
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">Con descuento</p>
                <p className="mt-1.5 text-2xl font-black tabular-nums text-slate-800">{discountsToday.length}</p>
              </div>
            </div>
            {/* Buscador */}
            {(movFilter === "ventas" || movFilter === "todos") && (
              <div className="flex items-center gap-2">
                <input
                  type="search"
                  placeholder="Buscar por mesa, mesero, monto…"
                  className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--pos-primary)]/30"
                  value={movSearch}
                  onChange={(e) => setMovSearch(e.target.value)}
                />
                {movSearch && (
                  <button type="button" className="text-xs text-slate-400 hover:text-slate-700" onClick={() => setMovSearch("")}>✕ Limpiar</button>
                )}
              </div>
            )}
            <p className="text-xs text-slate-500">
              {movFilter === "ventas" && "Historial de ventas registradas."}
              {movFilter === "descuentos" && "Tickets con descuento aplicado."}
              {movFilter === "gastos" && "Salidas de caja registradas en el período."}
            </p>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {movFilter === "todos" && (
                <>
                  {(() => {
                    const sorted = [...movements]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .filter((m) => {
                        if (!movSearch) return true;
                        const q = movSearch.toLowerCase();
                        return (
                          (m.note ?? "").toLowerCase().includes(q) ||
                          movementTypeLabel(m.type).toLowerCase().includes(q) ||
                          String(m.amount ?? "").includes(q)
                        );
                      });
                    return sorted.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                            <tr>
                              <th className="px-3 py-3">Tipo</th>
                              <th className="px-3 py-3 text-right">Monto</th>
                              <th className="px-3 py-3">Nota</th>
                              <th className="px-3 py-3">Fecha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map((m) => {
                              const d = registerMovementCashDelta(m);
                              return (
                                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="px-3 py-2">
                                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${
                                      m.type === "in" ? "bg-emerald-100 text-emerald-800" :
                                      m.type === "out" ? "bg-rose-100 text-rose-800" :
                                      m.type === "open" ? "bg-sky-100 text-sky-800" :
                                      m.type === "close" ? "bg-slate-100 text-slate-700" :
                                      "bg-amber-100 text-amber-800"
                                    }`}>
                                      {movementTypeLabel(m.type)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                    <span className={d > 0 ? "text-emerald-700" : d < 0 ? "text-rose-700" : "text-slate-600"}>
                                      {d > 0 ? "+" : ""}{d !== 0 ? `$${d.toFixed(2)}` : `$${Math.abs(Number(m.amount) || 0).toFixed(2)}`}
                                    </span>
                                  </td>
                                  <td className="max-w-[200px] truncate px-3 py-2 text-xs text-slate-600">{m.note ?? "—"}</td>
                                  <td className="whitespace-nowrap px-3 py-2 text-xs">{fmtDT(m.createdAt)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="p-8 text-center text-slate-500">
                        {movements.length === 0 ? "Sin movimientos aún. Abre la caja para empezar." : "Sin resultados para tu búsqueda."}
                      </p>
                    );
                  })()}
                </>
              )}

              {movFilter === "ventas" && (
                <>
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                      <tr>
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
                      {[...sales]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .filter((s) => {
                          if (!movSearch) return true;
                          const q = movSearch.toLowerCase();
                          return (
                            (s.tableId ?? "").toLowerCase().includes(q) ||
                            (s.serverName ?? "").toLowerCase().includes(q) ||
                            (s.customerName ?? "").toLowerCase().includes(q) ||
                            s.total.toFixed(2).includes(q)
                          );
                        })
                        .map((s) => (
                        <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3 py-2 text-xs">{fmtDT(s.createdAt)}</td>
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
                                `−$${(s.discount ?? 0).toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700">${s.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  {sales.length === 0 && (
                    <p className="p-8 text-center text-slate-500">Sin ventas registradas aún en esta sesión.</p>
                  )}
                </>
              )}

              {movFilter === "descuentos" && (
                <>
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Fecha</th>
                        <th className="px-3 py-3">Tipo dto.</th>
                        <th className="px-3 py-3">Descripción</th>
                        <th className="px-3 py-3">%</th>
                        <th className="px-3 py-3">Descuento</th>
                        <th className="px-3 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...sales]
                        .filter((s) => (s.discount ?? 0) > 0)
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((s) => (
                        <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3 py-2 text-xs">{fmtDT(s.createdAt)}</td>
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
                  </div>
                  {sales.filter((s) => (s.discount ?? 0) > 0).length === 0 && (
                    <p className="p-8 text-center text-slate-500">Sin ventas con descuento en esta sesión.</p>
                  )}
                </>
              )}

              {movFilter === "gastos" && (
                <>
                  {(() => {
                    const gastos = [...movements]
                      .filter((m) => m.type === "out")
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    return gastos.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                            <tr>
                              <th className="px-3 py-3">Fecha</th>
                              <th className="px-3 py-3 text-right">Monto</th>
                              <th className="px-3 py-3">Concepto / nota</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gastos.map((m) => (
                              <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="whitespace-nowrap px-3 py-2 text-xs">{fmtDT(m.createdAt)}</td>
                                <td className="px-3 py-2 text-right font-semibold tabular-nums text-rose-700">
                                  −${Math.abs(Number(m.amount) || 0).toFixed(2)}
                                </td>
                                <td className="max-w-[280px] truncate px-3 py-2 text-sm text-slate-700">{m.note ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="p-8 text-center text-sm text-slate-500">
                        Sin gastos registrados. Añade un gasto desde la pestaña Gastos.
                      </p>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        )}

        {subTab === "arqueos" && (
          <div className="animate-fade-in space-y-6">
            {es.arqueosHub.registerRedirectNote && (
              <p className="text-xs text-slate-500">{es.arqueosHub.registerRedirectNote}</p>
            )}
            {arqueosHistorySource === "pos" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">Período:</span>
                {(["today", "7d", "30d", "month", "all"] as const).map((f) => {
                  const labels = { today: "Hoy", "7d": "7 días", "30d": "30 días", month: "Este mes", all: "Todo" };
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setArqueosQuickFilter(f)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                        arqueosQuickFilter === f
                          ? "border-[var(--pos-primary)] bg-white text-[var(--pos-primary)] shadow-sm"
                          : "border-transparent bg-white/60 text-slate-600 hover:border-slate-200 hover:bg-white"
                      }`}
                      style={arqueosQuickFilter === f ? { borderColor: "var(--pos-primary)", color: "var(--pos-primary)" } : undefined}
                    >
                      {labels[f]}
                    </button>
                  );
                })}
                <a
                  href="/api/register/movements/export"
                  className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  download
                >
                  ↓ Descargar CSV
                </a>
              </div>
            )}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">{es.arqueosHub.sectionOperations}</h2>
                <p className="mt-2 text-sm text-slate-700">
                  Estado:{" "}
                  <strong className={registerOpen === true ? "text-emerald-700" : registerOpen === false ? "text-rose-600" : "text-slate-500"}>
                    {registerOpen === true
                      ? `Caja abierta (última base declarada $${openingFloat.toFixed(2)})`
                      : registerOpen === false ? "Caja cerrada" : "Verificando estado…"}
                  </strong>
                </p>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-800">{es.register.title}</h3>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={openFormHasBase}
                      onChange={(e) => setOpenFormHasBase(e.target.checked)}
                      disabled={registerOpen === true}
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
                        disabled={registerOpen === true}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => void submitOpenRegister()}
                    disabled={registerOpen === true}
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
                    disabled={registerOpen !== true}
                  />
                  {registerOpen === true && closeFormAmount !== "" && (
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {es.register.difference}: $
                      {((Number(closeFormAmount) || 0) - expectedRunning).toFixed(2)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">{es.arqueosHub.closeOnlyWhenOpen}</p>
                  <button
                    type="button"
                    onClick={() => void submitCloseRegister()}
                    disabled={registerOpen !== true}
                    className="mt-3 w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-extrabold uppercase text-slate-800 disabled:opacity-45"
                  >
                    {es.register.close}
                  </button>
                </div>
              </div>

              {canAdminRegister ? (
                <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-6 shadow-sm">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-violet-950">
                    <CircleDollarSign className="h-5 w-5 shrink-0" />
                    {es.arqueosHub.adminPanel}
                  </h2>
                  <p className="mt-1 text-xs text-violet-900/80">{es.arqueosHub.adminPanelHint}</p>
                  <div className="mt-4 rounded-xl border border-violet-100 bg-white p-4">
                    <h3 className="text-sm font-bold text-slate-800">{es.arqueosHub.adjustTitle}</h3>
                    <label className="mt-2 block text-xs font-bold uppercase text-slate-500">
                      {es.arqueosHub.adjustAmount}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      placeholder="Ej. 10.50 o -5.00"
                      disabled={arqueosBusy}
                    />
                    <label className="mt-2 block text-xs font-bold uppercase text-slate-500">
                      {es.arqueosHub.adjustNote}
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                      placeholder="Ej. Diferencia contada / error de tipeo"
                      disabled={arqueosBusy}
                    />
                    <button
                      type="button"
                      disabled={arqueosBusy}
                      onClick={() => void submitManualAdjust()}
                      className="btn-pos-primary mt-3 w-full py-2.5 text-sm font-extrabold uppercase text-white disabled:opacity-50"
                    >
                      {es.arqueosHub.adjustSubmit}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-800">{es.arqueosHub.sectionHistory}</h2>
                  <p className="mt-2 text-sm text-slate-600">{es.arqueosHub.historyHint}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    Vista rápida (30 días): {movementsLastMonth.length} movimientos. El detalle completo está abajo en
                    historial mensual.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">{es.arqueosHub.sectionMonthly}</h2>
                <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setArqueosHistorySource("pos");
                      setArqueosMonthKey("all");
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide ${
                      arqueosHistorySource === "pos"
                        ? "bg-slate-900 text-white shadow"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    {es.arqueosHub.historySourcePos}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setArqueosHistorySource("import");
                      setArqueosMonthKey("all");
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide ${
                      arqueosHistorySource === "import"
                        ? "bg-emerald-700 text-white shadow"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    {es.arqueosHub.historySourceImport}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {arqueosHistorySource === "pos"
                  ? es.arqueosHub.monthlyHint
                  : es.arqueosHub.importHistoryHint.replace("{source}", importedSalesStats.source)}
              </p>
              {arqueosHistorySource === "import" && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[0.7rem] text-emerald-950">
                  <span>
                    <span className="font-bold">{es.arqueosHub.importSourceLabel}:</span>{" "}
                    {importedSalesStats.source}
                  </span>
                  <span>
                    <span className="font-bold">{es.arqueosHub.importTicketsTotal}:</span>{" "}
                    {importedSalesStats.transactionCount.toLocaleString("es-EC")}
                  </span>
                  <span className="text-emerald-800/90">
                    {new Date(importedSalesStats.dateFrom).toLocaleDateString("es-EC")} —{" "}
                    {new Date(importedSalesStats.dateTo).toLocaleDateString("es-EC")}
                  </span>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500">Mes</label>
                  <select
                    className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                    value={arqueosMonthKey}
                    onChange={(e) => setArqueosMonthKey(e.target.value)}
                  >
                    <option value="all">{es.arqueosHub.monthAll}</option>
                    {(arqueosHistorySource === "import" ? importMonthOptions : monthOptions).map((ym) => (
                      <option key={ym} value={ym}>
                        {formatMonthLabel(ym)}
                      </option>
                    ))}
                  </select>
                </div>
                {arqueosHistorySource === "pos" ? (
                  <>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 text-sm">
                      <span className="text-slate-500">{es.arqueosHub.monthSummary}: </span>
                      <strong className="tabular-nums text-slate-900">{arqueosFiltered.length}</strong>
                      {arqueosMonthKey !== "all" && (
                        <>
                          <span className="mx-2 text-slate-300">·</span>
                          <span className="text-slate-500">{es.arqueosHub.monthBalanceHint} </span>
                          <strong
                            className={`tabular-nums ${monthCashSum >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                          >
                            {monthCashSum >= 0 ? "+" : ""}
                            ${monthCashSum.toFixed(2)}
                          </strong>
                        </>
                      )}
                    </div>
                    <div className="ml-auto text-xs text-slate-500">
                      {es.register.expected} (global):{" "}
                      <strong className="tabular-nums text-slate-800">${expectedRunning.toFixed(2)}</strong>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-wrap gap-3 text-sm">
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-4 py-2">
                      <span className="text-xs font-bold uppercase text-emerald-900">
                        {es.arqueosHub.importScopeTotals}
                      </span>
                      <p className="mt-1 tabular-nums text-emerald-950">
                        {arqueosMonthKey === "all" ? `${arqueosImportRows.length} meses · ` : ""}
                        {importScopeTotals.tickets.toLocaleString("es-EC")} tickets · $
                        {importScopeTotals.revenue.toFixed(2)} ingresos
                      </p>
                      <p className="text-xs text-emerald-900/85">
                        Efe. ${importScopeTotals.cash.toFixed(2)} · Tarj. $
                        {importScopeTotals.card.toFixed(2)} · Transf. $
                        {importScopeTotals.transfer.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
                {arqueosHistorySource === "pos" ? (
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2 text-right">Monto reg.</th>
                        <th className="px-3 py-2 text-right">{es.arqueosHub.cashDeltaCol}</th>
                        <th className="px-3 py-2">Nota</th>
                        {canAdminRegister && <th className="px-3 py-2 text-right">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {arqueosFiltered.map((m) => {
                        const delta = registerMovementCashDelta(m);
                        const voided = voidedMovementIds.has(m.id);
                        const canVoidThis = canAdminRegister && !voided && m.type !== "close";
                        return (
                          <tr
                            key={m.id}
                            className={`border-b border-slate-100 ${voided ? "bg-amber-50/50 opacity-80" : ""}`}
                          >
                            <td className="whitespace-nowrap px-3 py-2 text-xs">{fmtDT(m.createdAt)}</td>
                            <td className="px-3 py-2">
                              <span className="font-medium">{movementTypeLabel(m.type)}</span>
                              {voided && (
                                <span className="ml-2 text-[0.65rem] font-bold uppercase text-amber-800">
                                  {es.arqueosHub.voidedRow}
                                </span>
                              )}
                              {m.voidsMovementId && (
                                <span className="ml-1 block text-[0.65rem] text-slate-500">
                                  → ref. {m.voidsMovementId}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {m.type === "adjustment"
                                ? `${(Number(m.amount) || 0) >= 0 ? "" : "−"}$${Math.abs(Number(m.amount) || 0).toFixed(2)}`
                                : `$${Math.abs(Number(m.amount) || 0).toFixed(2)}`}
                            </td>
                            <td
                              className={`px-3 py-2 text-right text-sm font-bold tabular-nums ${
                                delta > 0 ? "text-emerald-700" : delta < 0 ? "text-rose-700" : "text-slate-500"
                              }`}
                            >
                              {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}$${delta.toFixed(2)}`}
                            </td>
                            <td className="max-w-[240px] truncate px-3 py-2 text-xs text-slate-600" title={m.note ?? ""}>
                              {m.note ?? "—"}
                            </td>
                            {canAdminRegister && (
                              <td className="px-3 py-2 text-right">
                                {canVoidThis ? (
                                  <button
                                    type="button"
                                    disabled={arqueosBusy}
                                    onClick={() => void submitVoidMovement(m.id)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-[0.65rem] font-bold uppercase text-rose-800 hover:bg-rose-50 disabled:opacity-50"
                                  >
                                    <Ban className="h-3 w-3" />
                                    {es.arqueosHub.voidMovement}
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">{es.arqueosHub.importColMonth}</th>
                        <th className="px-3 py-2 text-right">{es.arqueosHub.importColTickets}</th>
                        <th className="px-3 py-2 text-right">{es.arqueosHub.importColRevenue}</th>
                        <th className="px-3 py-2 text-right">{es.arqueosHub.importColCash}</th>
                        <th className="px-3 py-2 text-right">{es.arqueosHub.importColCard}</th>
                        <th className="px-3 py-2 text-right">{es.arqueosHub.importColTransfer}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {arqueosImportRows.map(({ ym, row }) => {
                        if (!row) return null;
                        return (
                          <tr key={ym} className="border-b border-slate-100">
                            <td className="px-3 py-2 font-semibold text-slate-800">{formatMonthLabel(ym)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{row.tickets.toLocaleString("es-EC")}</td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-800">
                              ${row.revenue.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-700">${row.cash.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-700">${row.card.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-700">${row.transfer.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {arqueosHistorySource === "pos" && arqueosFiltered.length === 0 && (
                <p className="mt-4 text-center text-sm text-slate-500">Sin movimientos en este período.</p>
              )}
              {arqueosHistorySource === "import" && arqueosImportRows.length === 0 && (
                <p className="mt-4 text-center text-sm text-slate-500">
                  Sin movimientos en el período seleccionado.
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
