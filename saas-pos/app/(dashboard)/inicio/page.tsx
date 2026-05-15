import Link from "next/link";
import { getCurrentUserMock } from "@/lib/auth";
import { pullRuntimeFromCloud } from "@/lib/cloud-sync";
import { getStoreSnapshot } from "@/lib/store";
import { getRegisterSessionSnapshot } from "@/lib/register-session-store";
import { importedSalesSeed } from "@/lib/data/imported-sales-sample";
import type { Sale } from "@/lib/types";

export const dynamic = "force-dynamic";

function isTodayIso(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatToday(): string {
  return new Date().toLocaleDateString("es", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatMoney(n: number): string {
  return n.toLocaleString("es", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type QuickActionProps = {
  href: string;
  icon: string;
  label: string;
  hint?: string;
};

function QuickAction({ href, icon, label, hint }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3.5 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md"
      style={{ borderColor: "var(--pos-border)" }}
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-slate-900">{label}</p>
        {hint ? (
          <p className="truncate text-xs font-medium text-slate-500">{hint}</p>
        ) : null}
      </div>
    </Link>
  );
}

export default async function InicioPage() {
  const user = await getCurrentUserMock();
  await pullRuntimeFromCloud();

  const snap = getStoreSnapshot();
  const registerState = getRegisterSessionSnapshot();

  // Unir ventas POS de sesión + ventas importadas (sin duplicar por id).
  const seenIds = new Set<string>();
  const allSales: Sale[] = [];
  for (const s of snap.sales) {
    if (!seenIds.has(s.id)) {
      seenIds.add(s.id);
      allSales.push(s);
    }
  }
  for (const s of importedSalesSeed) {
    if (!seenIds.has(s.id)) {
      seenIds.add(s.id);
      allSales.push(s);
    }
  }

  const salesToday = allSales.filter((s) => isTodayIso(s.createdAt));
  const revenueToday = salesToday.reduce((n, s) => n + (s.total ?? 0), 0);
  const salesCountToday = salesToday.length;

  const movementsToday = snap.registerMovements.filter((m) => isTodayIso(m.createdAt));
  const expensesToday = movementsToday
    .filter((m) => m.type === "out")
    .reduce((n, m) => n + (m.amount ?? 0), 0);
  const balanceToday = revenueToday - expensesToday;

  const activeTables = Object.keys(snap.tableAssignments ?? {}).length;

  const pendingKitchen = snap.kitchenTickets.filter(
    (t) => t.status === "pending" || t.status === "preparing",
  ).length;

  const firstName = user.fullName.split(" ")[0] || user.fullName;
  const isRegisterOpen = registerState.isOpen;

  return (
    <div className="space-y-5">
      {/* Saludo + estado de caja */}
      <header
        className="rounded-2xl border bg-white p-5 shadow-sm"
        style={{ borderColor: "var(--pos-border)" }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {formatToday()}
        </p>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Hola, {firstName}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {isRegisterOpen
            ? "Caja abierta — listos para vender."
            : "Caja cerrada — ábrela para comenzar a vender."}
        </p>
      </header>

      {/* KPIs grid */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Ingresos hoy */}
        <div
          className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm"
          style={{ borderColor: "rgb(167 243 208)" }}
        >
          <div
            className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
            style={{ backgroundColor: "rgb(52 211 153)" }}
          />
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-emerald-700">
            Ingresos hoy
          </p>
          <p className="mt-1.5 text-2xl font-black tabular-nums text-emerald-900 sm:text-3xl">
            ${formatMoney(revenueToday)}
          </p>
          <p className="mt-0.5 text-[0.65rem] font-medium text-emerald-700">
            {salesCountToday} venta{salesCountToday !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Gastos hoy */}
        <div
          className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm"
          style={{ borderColor: "rgb(254 205 211)" }}
        >
          <div
            className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
            style={{ backgroundColor: "rgb(244 114 182)" }}
          />
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-rose-700">
            Gastos hoy
          </p>
          <p className="mt-1.5 text-2xl font-black tabular-nums text-rose-900 sm:text-3xl">
            ${formatMoney(expensesToday)}
          </p>
          <p className="mt-0.5 text-[0.65rem] font-medium text-rose-700">
            {movementsToday.filter((m) => m.type === "out").length} movimiento
            {movementsToday.filter((m) => m.type === "out").length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Balance del día */}
        <div
          className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm"
          style={{ borderColor: "rgb(186 230 253)" }}
        >
          <div
            className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
            style={{ backgroundColor: "rgb(56 189 248)" }}
          />
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-sky-700">
            Balance neto
          </p>
          <p className="mt-1.5 text-2xl font-black tabular-nums text-sky-900 sm:text-3xl">
            ${formatMoney(balanceToday)}
          </p>
          <p className="mt-0.5 text-[0.65rem] font-medium text-sky-700">
            Ingresos − gastos del día
          </p>
        </div>

        {/* Ventas hoy (cantidad) */}
        <div
          className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm"
          style={{ borderColor: "rgb(253 230 138)" }}
        >
          <div
            className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
            style={{ backgroundColor: "rgb(251 191 36)" }}
          />
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-amber-700">
            Ventas hoy
          </p>
          <p className="mt-1.5 text-2xl font-black tabular-nums text-amber-900 sm:text-3xl">
            {salesCountToday}
          </p>
          <p className="mt-0.5 text-[0.65rem] font-medium text-amber-700">
            Tickets emitidos
          </p>
        </div>
      </section>

      {/* Estado operativo */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div
          className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm"
          style={{ borderColor: "rgb(199 210 254)" }}
        >
          <div
            className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
            style={{ backgroundColor: "rgb(129 140 248)" }}
          />
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-indigo-700">
            Mesas activas
          </p>
          <p className="mt-1.5 text-2xl font-black tabular-nums text-indigo-900 sm:text-3xl">
            {activeTables}
          </p>
          <p className="mt-0.5 text-[0.65rem] font-medium text-indigo-700">
            Mesas con sesión abierta
          </p>
        </div>

        <div
          className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-orange-50 to-white p-4 shadow-sm"
          style={{ borderColor: "rgb(254 215 170)" }}
        >
          <div
            className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
            style={{ backgroundColor: "rgb(251 146 60)" }}
          />
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-orange-700">
            Cocina pendiente
          </p>
          <p className="mt-1.5 text-2xl font-black tabular-nums text-orange-900 sm:text-3xl">
            {pendingKitchen}
          </p>
          <p className="mt-0.5 text-[0.65rem] font-medium text-orange-700">
            Tickets en preparación o pendientes
          </p>
        </div>
      </section>

      {/* Accesos rápidos */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-500">
          Accesos rápidos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href="/mesas"
            icon="🪑"
            label="Plano de mesas"
            hint={`${activeTables} activa${activeTables !== 1 ? "s" : ""}`}
          />
          <QuickAction
            href="/cocina"
            icon="👨‍🍳"
            label="Pantalla cocina"
            hint={`${pendingKitchen} pendiente${pendingKitchen !== 1 ? "s" : ""}`}
          />
          <QuickAction
            href="/ventas"
            icon="💰"
            label="Arqueo y ventas"
            hint={`${salesCountToday} hoy`}
          />
          <QuickAction
            href="/clientes"
            icon="👥"
            label="Clientes"
            hint={`${snap.customers.length} registrados`}
          />
        </div>
      </section>
    </div>
  );
}
