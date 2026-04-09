"use client";

import { useEffect, useMemo, useState } from "react";
import { LegacySectionStub } from "@/lib/components/LegacySectionStub";
import { ExportCsvPeriodLinks } from "@/lib/components/ExportCsvPeriodLinks";
import type { Customer } from "@/lib/types";

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
  const [reward50, setReward50] = useState("Premio 50 pts");
  const [reward100, setReward100] = useState("Premio 100 pts");
  const [reward150, setReward150] = useState("Premio 150 pts");

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
      window.alert("No se pudo crear el cliente.");
      return;
    }
    setName("");
    setPhone("");
    setEmail("");
    load();
  };

  const saveRewards = () => {
    localStorage.setItem(
      "pos_rewards_cfg_v1",
      JSON.stringify({ r50: reward50, r100: reward100, r150: reward150 }),
    );
  };

  const redeem = async (customerId: string, tier: 50 | 100 | 150) => {
    const res = await fetch("/api/customers/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, tier }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(
        data?.error === "insufficient_points"
          ? "Este cliente aún no tiene puntos suficientes."
          : "No se pudo registrar el canje.",
      );
      return;
    }
    load();
  };

  return (
    <LegacySectionStub
      title="Clientes"
      description="Clientes guardados (demo local en memoria). Permite crear y luego seleccionarlos al abrir mesa."
      legacyFile="pages/CashierDashboard.jsx (ClientesView)"
    >
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
              className="btn-primary w-full rounded-lg py-2.5 text-sm font-extrabold uppercase text-white"
              onClick={() => void add()}
            >
              Añadir cliente
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-extrabold uppercase text-slate-600">Plan de recompensas</p>
          <p className="mt-1 text-sm text-slate-700">
            En ventas por <strong>mesa</strong>: <strong>1 punto por cada $1</strong> del total (redondeo hacia abajo).
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Los puntos se acumulan automáticamente al cobrar una mesa con un cliente seleccionado.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[0.65rem] font-black uppercase text-slate-500">50 puntos</p>
              <input className="input-base mt-1 w-full text-sm" value={reward50} onChange={(e) => setReward50(e.target.value)} />
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[0.65rem] font-black uppercase text-slate-500">100 puntos</p>
              <input className="input-base mt-1 w-full text-sm" value={reward100} onChange={(e) => setReward100(e.target.value)} />
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[0.65rem] font-black uppercase text-slate-500">150 puntos</p>
              <input className="input-base mt-1 w-full text-sm" value={reward150} onChange={(e) => setReward150(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <button
                type="button"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold"
                onClick={saveRewards}
              >
                Guardar recompensas
              </button>
            </div>
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
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold" onClick={load}>
            Recargar
          </button>
          <ExportCsvPeriodLinks hrefBase="/api/customers/export" label="Exportar CSV" />
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-extrabold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Teléfono</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2 text-right">Puntos</th>
                <th className="px-3 py-2">Recompensas</th>
                <th className="px-3 py-2">Creado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-semibold">{c.name}</td>
                  <td className="px-3 py-2 text-slate-600">{fmtPhone(c.phone)}</td>
                  <td className="px-3 py-2 text-slate-600">{c.email ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-black tabular-nums text-slate-800">
                    {fmtInt(c.pointsBalance ?? 0)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { tier: 50 as const, label: reward50 },
                          { tier: 100 as const, label: reward100 },
                          { tier: 150 as const, label: reward150 },
                        ] as const
                      ).map((r) => {
                        const ok = (c.pointsBalance ?? 0) >= r.tier;
                        return (
                          <button
                            key={r.tier}
                            type="button"
                            disabled={!ok}
                            className={`rounded-full border px-2 py-1 text-[0.65rem] font-extrabold uppercase tracking-wide ${
                              ok
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                : "border-slate-200 bg-slate-50 text-slate-400"
                            }`}
                            title={r.label}
                            onClick={() => void redeem(c.id, r.tier)}
                          >
                            {ok ? `Reclamar ${r.tier}` : `${r.tier}`}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[0.65rem] text-slate-500">
                      Disponible si el cliente llega a 50/100/150. Al reclamar se descuentan puntos.
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                    {new Date(c.createdAt).toLocaleString("es-EC")}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    Sin clientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </LegacySectionStub>
  );
}

export default function ClientesPage() {
  return <ClientesClient />;
}
