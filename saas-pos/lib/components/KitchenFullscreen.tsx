"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KitchenTicket, SaleItem } from "@/lib/types";
import { Maximize2, Minimize2, ChefHat, Bell } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupKey(tk: KitchenTicket): string {
  return tk.channel === "table"
    ? `t:${tk.tableId ?? tk.tableLabel ?? "—"}`
    : `c:${tk.counterOrderId ?? tk.id}`;
}

function displayLabel(tk: KitchenTicket): string {
  return tk.channel === "table"
    ? (tk.tableLabel ?? tk.tableId ?? "Mesa")
    : `Mostrador`;
}

function mergeItems(list: KitchenTicket[]): SaleItem[] {
  const map = new Map<string, SaleItem>();
  for (const tk of list) {
    for (const i of tk.items) {
      const k = `${i.productId}\0${i.name}`;
      const ex = map.get(k);
      map.set(k, ex ? { ...ex, qty: ex.qty + i.qty, lineTotal: ex.lineTotal + i.lineTotal } : { ...i });
    }
  }
  return [...map.values()];
}

function oldestCreatedAt(list: KitchenTicket[]): string | null {
  let min = Infinity;
  for (const t of list) {
    const ms = new Date(t.createdAt).getTime();
    if (Number.isFinite(ms) && ms < min) min = ms;
  }
  return min === Infinity ? null : new Date(min).toISOString();
}

function minutesBetween(startIso: string, nowMs: number): number | null {
  const ms = new Date(startIso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(Math.max(0, nowMs - ms) / 60000);
}

function urgencyClass(mins: number | null) {
  if (mins === null) return { card: "border-slate-600 bg-slate-800", timer: "text-slate-400", badge: "" };
  if (mins < 5) return { card: "border-emerald-500 bg-slate-800", timer: "text-emerald-400", badge: "bg-emerald-600" };
  if (mins < 10) return { card: "border-amber-400 bg-amber-950/40", timer: "text-amber-300", badge: "bg-amber-500" };
  return { card: "border-red-500 bg-red-950/50 animate-pulse", timer: "text-red-400", badge: "bg-red-600" };
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KitchenFullscreen() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const prevActiveCount = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sonido de nueva orden (beep sintético)
  const playBeep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Sin soporte de AudioContext — ignorar
    }
  }, []);

  const load = useCallback(() => {
    fetch("/api/kitchen/tickets")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        const list: KitchenTicket[] = Array.isArray(d.data) ? d.data : [];
        setTickets(list);
        const activeCount = list.filter((t) => t.status !== "ready").length;
        if (activeCount > prevActiveCount.current) {
          playBeep();
          setNewOrderFlash(true);
          setTimeout(() => setNewOrderFlash(false), 1200);
        }
        prevActiveCount.current = activeCount;
      })
      .catch(() => {});
  }, [playBeep]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    const tick = setInterval(() => setNow(Date.now()), 10000);
    window.addEventListener("pos-kitchen-updated", load);
    return () => {
      clearInterval(t);
      clearInterval(tick);
      window.removeEventListener("pos-kitchen-updated", load);
    };
  }, [load]);

  // Fullscreen API
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const markGroupReady = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      await fetch(`/api/kitchen/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ready" }),
      });
    }
    load();
  }, [load]);

  const activeGroups = useMemo(() => {
    const g = new Map<string, KitchenTicket[]>();
    for (const tk of tickets) {
      if (tk.status !== "pending" && tk.status !== "preparing") continue;
      const k = groupKey(tk);
      g.set(k, [...(g.get(k) ?? []), tk]);
    }
    return [...g.entries()].sort((a, b) => {
      const tA = new Date(oldestCreatedAt(a[1]) ?? 0).getTime();
      const tB = new Date(oldestCreatedAt(b[1]) ?? 0).getTime();
      return tA - tB; // más antiguos primero
    });
  }, [tickets]);

  const readyGroups = useMemo(() => {
    const g = new Map<string, KitchenTicket[]>();
    for (const tk of tickets) {
      if (tk.status !== "ready") continue;
      const k = groupKey(tk);
      g.set(k, [...(g.get(k) ?? []), tk]);
    }
    return [...g.entries()].slice(0, 6); // últimos 6 listos
  }, [tickets]);

  return (
    <div
      ref={containerRef}
      className={`flex min-h-screen flex-col bg-slate-900 text-white ${newOrderFlash ? "ring-4 ring-orange-400 ring-inset" : ""} transition-all`}
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-orange-400" />
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">Cocina · KDS</h1>
            <p className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wide">
              Carpita POS · {new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Contador de pedidos activos */}
          <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 font-black text-lg ${activeGroups.length > 0 ? "bg-orange-500 text-white" : "bg-slate-700 text-slate-400"}`}>
            <Bell className="h-4 w-4" />
            {activeGroups.length}
            <span className="text-xs font-semibold uppercase tracking-wide">
              {activeGroups.length === 1 ? "pedido" : "pedidos"}
            </span>
          </div>
          {/* Hora */}
          <div className="text-right">
            <p className="text-2xl font-black tabular-nums text-white">
              {new Date(now).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          {/* Botón pantalla completa */}
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="rounded-lg border border-slate-600 bg-slate-700 p-2 text-slate-300 hover:bg-slate-600 hover:text-white transition"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Cuerpo */}
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {/* Pedidos en preparación */}
        <main className="min-w-0 flex-1">
          {activeGroups.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <ChefHat className="h-20 w-20 text-slate-700" />
              <p className="text-2xl font-black text-slate-600">Sin pedidos pendientes</p>
              <p className="text-sm text-slate-600">Los pedidos aparecen aquí automáticamente</p>
            </div>
          ) : (
            <div className="grid gap-3 auto-rows-max sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {activeGroups.map(([key, list]) => {
                const label = displayLabel(list[0]);
                const merged = mergeItems(list);
                const oldest = oldestCreatedAt(list);
                const mins = oldest ? minutesBetween(oldest, now) : null;
                const { card, timer, badge } = urgencyClass(mins);
                const ids = list.map((t) => t.id);

                return (
                  <article
                    key={key}
                    className={`flex flex-col rounded-2xl border-2 p-4 transition-all ${card}`}
                  >
                    {/* Mesa / mostrador */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-4xl font-black tracking-tight text-white leading-none">
                          {label}
                        </p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                          {list[0].channel === "table" ? "Mesa" : "Mostrador"}
                        </p>
                      </div>
                      {mins !== null && (
                        <div className={`rounded-full px-3 py-1 text-sm font-extrabold tabular-nums text-white ${badge}`}>
                          {mins} min
                        </div>
                      )}
                    </div>

                    {/* Hora de entrada */}
                    {oldest && (
                      <p className={`mt-1 text-xs font-semibold ${timer}`}>
                        Entrada: {fmtTime(oldest)}
                      </p>
                    )}

                    {/* Items */}
                    <ul className="mt-3 flex-1 space-y-2">
                      {merged.map((i) => (
                        <li
                          key={`${i.productId}-${i.name}`}
                          className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-700/50 px-3 py-2"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-sm font-black text-white">
                            {i.qty}
                          </span>
                          <span className="text-base font-bold text-white leading-tight">{i.name}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Botón listo */}
                    <button
                      type="button"
                      className="mt-4 w-full rounded-xl bg-emerald-500 py-4 text-xl font-black uppercase tracking-wide text-white shadow-lg hover:bg-emerald-400 active:scale-95 transition-all"
                      onClick={() => void markGroupReady(ids)}
                    >
                      ✓ Listo
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        {/* Panel de listos (historial reciente) */}
        {readyGroups.length > 0 && (
          <aside className="w-56 shrink-0 xl:w-64">
            <h2 className="mb-2 text-[0.65rem] font-black uppercase tracking-widest text-slate-500">
              Listos recientemente
            </h2>
            <ul className="space-y-2">
              {readyGroups.map(([key, list]) => {
                const label = displayLabel(list[0]);
                const merged = mergeItems(list);
                return (
                  <li
                    key={key}
                    className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-base font-black text-emerald-400">{label}</p>
                      <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[0.6rem] font-extrabold uppercase text-emerald-400">
                        Listo
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-0.5">
                      {merged.map((i) => (
                        <li key={`${i.productId}-${i.name}`} className="text-xs text-slate-400">
                          <span className="font-bold text-white">{i.qty}×</span> {i.name}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>

      {/* Footer — link para volver */}
      <footer className="border-t border-slate-800 px-4 py-2 text-center">
        <a
          href="/cocina"
          className="text-[0.65rem] text-slate-600 hover:text-slate-400 transition"
        >
          ← Vista estándar
        </a>
        <span className="mx-2 text-slate-700">·</span>
        <span className="text-[0.65rem] text-slate-700">
          Actualización automática cada 4 s
        </span>
      </footer>
    </div>
  );
}
