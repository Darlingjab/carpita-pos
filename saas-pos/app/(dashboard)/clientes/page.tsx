"use client";

import { useEffect, useMemo, useState } from "react";
import { ExportCsvPeriodLinks } from "@/lib/components/ExportCsvPeriodLinks";
import { ToastBanner } from "@/lib/components/ToastBanner";
import { ConfirmDialog } from "@/lib/components/ConfirmDialog";
import type { Customer } from "@/lib/types";

/** Segmentación rápida basada en puntos y fecha de registro */
function getSegment(c: Customer): { label: string; color: string } {
  const daysSinceCreated = (Date.now() - new Date(c.createdAt).getTime()) / 86400000;
  if ((c.pointsBalance ?? 0) >= 100) return { label: "Frecuente", color: "bg-emerald-100 text-emerald-800" };
  if ((c.pointsBalance ?? 0) >= 30) return { label: "Regular", color: "bg-blue-100 text-blue-800" };
  if (daysSinceCreated < 14) return { label: "Nuevo", color: "bg-amber-100 text-amber-800" };
  if ((c.pointsBalance ?? 0) === 0) return { label: "Sin actividad", color: "bg-slate-100 text-slate-600" };
  return { label: "Ocasional", color: "bg-purple-100 text-purple-800" };
}

/** Siguiente milestone de puntos */
function nextMilestone(pts: number): { target: number; pct: number } {
  const tiers = [50, 100, 150];
  for (const t of tiers) {
    if (pts < t) return { target: t, pct: Math.round((pts / t) * 100) };
  }
  return { target: 150, pct: 100 };
}

function fmtPhone(p: string | null | undefined) {
  if (!p) return "—";
  return p;
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("es-EC").format(n);
}

export function ClientesClient() {
  const [items, setItems] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [q, setQ] = useState("");
  const [reward50, setReward50] = useState("Descuento 10%");
  const [reward100, setReward100] = useState("Almuerzo gratis");
  const [reward150, setReward150] = useState("2×1 en bebidas");
  const [rewardFlash, setRewardFlash] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [redeemConfirm, setRedeemConfirm] = useState<{ customerId: string; tier: 50 | 100 | 150; label: string } | null>(null);

  function showToast(msg: string) { setToastMsg(msg); }

  const isAdmin = myRole === "admin";

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMyRole(d?.data?.role ?? null))
      .catch(() => setMyRole(null));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pos_rewards_cfg_v1");
      if (!raw) return;
      const cfg = JSON.parse(raw) as { r50?: string; r100?: string; r150?: string };
      if (cfg.r50) setReward50(cfg.r50);
      if (cfg.r100) setReward100(cfg.r100);
      if (cfg.r150) setReward150(cfg.r150);
    } catch {
      /* ignore */
    }
  }, []);

  const load = () => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => setItems(d.data ?? []))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) => c.name.toLowerCase().includes(s));
  }, [items, q]);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: n,
        phone: phone.trim() || null,
        email: email.trim() || null,
      }),
    });
    if (!res.ok) {
      showToast("No se pudo crear el cliente.");
      return;
    }
    setName("");
    setPhone("");
    setEmail("");
    load();
  };

  const saveRewards = () => {
    if (!isAdmin) return;
    localStorage.setItem(
      "pos_rewards_cfg_v1",
      JSON.stringify({ r50: reward50, r100: reward100, r150: reward150 }),
    );
    setRewardFlash(true);
    window.setTimeout(() => setRewardFlash(false), 2200);
  };

  const redeem = async (customerId: string, tier: 50 | 100 | 150) => {
    const res = await fetch("/api/customers/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, tier }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(
        data?.error === "insufficient_points"
          ? "Este cliente aún no tiene puntos suficientes."
          : "No se pudo registrar el canje.",
      );
      return;
    }
    load();
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Clientes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registrá clientes para asignarlos a mesas y acumular puntos de fidelidad automáticamente.
        </p>
      </div>
      <div className="space-y-4">
        <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase text-slate-500">Nombre</label>
            <input className="input-base mt-1 w-full text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase text-slate-500">Teléfono</label>
            <input className="input-base mt-1 w-full text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase text-slate-500">Email</label>
            <input className="input-base mt-1 w-full text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="sm:col-span-6">
            <button
              type="button"
              className="btn-primary w-full rounded-lg py-2.5 text-sm font-extrabold uppercase text-white disabled:opacity-50"
              onClick={() => void add()}
              disabled={!name.trim()}
            >
              Añadir cliente
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-extrabold uppercase text-slate-600">Plan de recompensas</p>
            {isAdmin ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-emerald-700">
                Admin — puede editar
              </span>
            ) : (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-slate-600">
                Solo lectura
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-700">
            En ventas por <strong>mesa</strong>: <strong>1 punto por cada $1</strong> del total (redondeo hacia abajo).
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Los puntos se acumulan automáticamente al cobrar una mesa con un cliente seleccionado.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {(
              [
                { pts: 50, val: reward50, set: setReward50 },
                { pts: 100, val: reward100, set: setReward100 },
                { pts: 150, val: reward150, set: setReward150 },
              ] as const
            ).map(({ pts, val, set }) => (
              <div key={pts} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[0.65rem] font-black uppercase text-slate-500">{pts} puntos</p>
                {isAdmin ? (
                  <input
                    className="input-base mt-1 w-full text-sm"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-semibold text-slate-800">{val}</p>
                )}
              </div>
            ))}
            {isAdmin && (
              <div className="flex items-center gap-3 sm:col-span-3">
                <button
                  type="button"
                  className="btn-pos-primary rounded-lg px-5 py-2.5 text-sm font-extrabold uppercase"
                  onClick={saveRewards}
                >
                  Guardar recompensas
                </button>
                {rewardFlash && (
                  <span className="text-xs font-semibold text-emerald-600">✓ Guardado</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="search"
            className="input-base w-full max-w-sm text-sm"
            placeholder="Buscar cliente…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold transition-colors hover:bg-slate-50" onClick={load}>
            Recargar
          </button>
          <ExportCsvPeriodLinks hrefBase="/api/customers/export" label="Exportar CSV" />
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-slate-500">
              Sin clientes registrados
            </div>
          )}
          {filtered.map((c) => {
            const pts = c.pointsBalance ?? 0;
            const { label: segLabel, color: segColor } = getSegment(c);
            const { target, pct } = nextMilestone(pts);
            return (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{c.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold uppercase ${segColor}`}>
                        {segLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {fmtPhone(c.phone)}{c.email ? ` · ${c.email}` : ""}
                      {" · "}{new Date(c.createdAt).toLocaleDateString("es-EC")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black tabular-nums text-slate-900">{fmtInt(pts)} <span className="text-xs font-semibold text-slate-500">pts</span></p>
                  </div>
                </div>
                {/* Barra de progreso de puntos */}
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[0.6rem] text-slate-500">
                    <span>{pts} pts actuales</span>
                    <span>Próxima recompensa: {target} pts</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
                {/* Canjear recompensas */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      { tier: 50 as const, label: reward50 },
                      { tier: 100 as const, label: reward100 },
                      { tier: 150 as const, label: reward150 },
                    ] as const
                  ).map((r) => {
                    const ok = pts >= r.tier;
                    return (
                      <button
                        key={r.tier}
                        type="button"
                        disabled={!ok}
                        title={ok ? `Canjear: ${r.label}` : `Faltan ${r.tier - pts} puntos`}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold ${
                          ok
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "border-slate-100 bg-slate-50 text-slate-400"
                        }`}
                        onClick={() => {
                          if (!ok) return;
                          setRedeemConfirm({ customerId: c.id, tier: r.tier, label: r.label });
                        }}
                      >
                        {ok ? "🎁" : "🔒"} {r.tier} pts → {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ToastBanner message={toastMsg} onDismiss={() => setToastMsg(null)} />
      <ConfirmDialog
        open={redeemConfirm !== null}
        title="Canjear recompensa"
        message={`¿Canjear ${redeemConfirm?.tier ?? 0} puntos por: "${redeemConfirm?.label ?? ""}"? Esto descontará ${redeemConfirm?.tier ?? 0} puntos del cliente.`}
        confirmLabel="Canjear"
        cancelLabel="Cancelar"
        onConfirm={() => { const rc = redeemConfirm; setRedeemConfirm(null); if (rc) void redeem(rc.customerId, rc.tier); }}
        onCancel={() => setRedeemConfirm(null)}
      />
    </div>
  );
}

export default function ClientesPage() {
  return <ClientesClient />;
}
