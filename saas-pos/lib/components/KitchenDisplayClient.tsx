"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KitchenTicket, SaleItem } from "@/lib/types";
import { es } from "@/lib/locale";

function groupKey(tk: KitchenTicket): string {
  if (tk.channel === "table") {
    return `t:${tk.tableId ?? tk.tableLabel ?? "—"}`;
  }
  return `c:${tk.counterOrderId ?? tk.id}`;
}

function displayLabel(tk: KitchenTicket): string {
  if (tk.channel === "table") {
    return tk.tableLabel ?? tk.tableId ?? "Mesa";
  }
  return `Mostrador ${(tk.counterOrderId ?? tk.id).replace(/^co_/, "").slice(-6)}`;
}

function minutesBetween(startIso: string, endMs: number) {
  const start = new Date(startIso).getTime();
  if (!Number.isFinite(start)) return null;
  return Math.floor(Math.max(0, endMs - start) / 60000);
}

function mergeItems(ticketList: KitchenTicket[]): SaleItem[] {
  const map = new Map<string, SaleItem>();
  for (const tk of ticketList) {
    for (const i of tk.items) {
      const k = `${i.productId}\0${i.name}`;
      const ex = map.get(k);
      if (ex) {
        map.set(k, {
          ...ex,
          qty: ex.qty + i.qty,
          lineTotal: ex.lineTotal + i.lineTotal,
        });
      } else {
        map.set(k, { ...i });
      }
    }
  }
  return [...map.values()];
}

function oldestCreatedAt(ticketList: KitchenTicket[]) {
  let min = Infinity;
  for (const t of ticketList) {
    const ms = new Date(t.createdAt).getTime();
    if (Number.isFinite(ms) && ms < min) min = ms;
  }
  return min === Infinity ? null : new Date(min).toISOString();
}

function timeAccent(mins: number | null): { wrap: string; delay: boolean } {
  if (mins == null) return { wrap: "border-2 border-slate-300 bg-white", delay: false };
  if (mins < 5)
    return {
      wrap: "border-[3px] border-emerald-500 bg-emerald-50/40 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]",
      delay: false,
    };
  if (mins < 10)
    return {
      wrap: "border-[3px] border-amber-500 bg-amber-50/40 shadow-[0_0_0_3px_rgba(245,158,11,0.18)]",
      delay: false,
    };
  return {
    wrap: "border-[3px] border-red-600 bg-red-50/50 shadow-[0_0_0_3px_rgba(220,38,38,0.2)]",
    delay: true,
  };
}

export function KitchenDisplayClient() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [loadError, setLoadError] = useState<"forbidden" | "network" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [expandedPast, setExpandedPast] = useState<Record<string, boolean>>({});
  const [checkedByGroup, setCheckedByGroup] = useState<Record<string, Record<string, number>>>({});
  const [kdsBusy, setKdsBusy] = useState(false);
  const autoReadyLocks = useRef(new Set<string>());
  const prevTicketCountRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  /** Activa el AudioContext mediante un gesto del usuario (necesario en Safari iOS). */
  function enableAudio() {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      void audioCtxRef.current.resume();
      setAudioEnabled(true);
    } catch {
      /* ignore */
    }
  }

  /** Genera un beep de cocina usando Web Audio API */
  function playKitchenBeep() {
    if (!audioEnabled || !audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      // Segundo beep
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "square";
      osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.5);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.5);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      osc2.start(ctx.currentTime + 0.5);
      osc2.stop(ctx.currentTime + 0.9);
    } catch {
      // Web Audio API no disponible (SSR, etc.)
    }
  }

  const load = useCallback(() => {
    fetch("/api/kitchen/tickets")
      .then((r) => {
        if (r.status === 403) {
          setLoadError("forbidden");
          setTickets([]);
          return null;
        }
        if (!r.ok) {
          setLoadError("network");
          setTickets([]);
          return null;
        }
        setLoadError(null);
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        const incoming: KitchenTicket[] = Array.isArray(d.data) ? d.data : [];
        setTickets(incoming);
        // Detectar tickets nuevos y reproducir alarma
        const newCount = incoming.filter(
          (t) => t.status === "pending" || t.status === "preparing"
        ).length;
        if (prevTicketCountRef.current !== null && newCount > prevTicketCountRef.current) {
          playKitchenBeep();
        }
        prevTicketCountRef.current = newCount;
      })
      .catch(() => {
        setLoadError("network");
        setTickets([]);
      });
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 4000);
    const tick = window.setInterval(() => setNow(Date.now()), 15000);
    window.addEventListener("pos-kitchen-updated", load);
    return () => {
      window.clearInterval(t);
      window.clearInterval(tick);
      window.removeEventListener("pos-kitchen-updated", load);
    };
  }, [load]);

  const markGroupReady = useCallback(async (ids: string[]) => {
    setKdsBusy(true);
    try {
      for (const id of ids) {
        await fetch(`/api/kitchen/tickets/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ready" }),
        });
      }
      load();
    } finally {
      setKdsBusy(false);
    }
  }, [load]);

  async function returnGroupToPreparing(ids: string[]) {
    setKdsBusy(true);
    try {
      for (const id of ids) {
        await fetch(`/api/kitchen/tickets/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "preparing" }),
        });
      }
      load();
    } finally {
      setKdsBusy(false);
    }
  }

  function markItemReady(groupId: string, itemKey: string, qty: number) {
    setCheckedByGroup((prev) => {
      const currentGroup = prev[groupId] ?? {};
      const current = Math.min(qty, currentGroup[itemKey] ?? 0);
      const next = current >= qty ? 0 : qty;
      return {
        ...prev,
        [groupId]: {
          ...currentGroup,
          [itemKey]: next,
        },
      };
    });
  }

  const activeGroups = useMemo(() => {
    const g = new Map<string, KitchenTicket[]>();
    for (const tk of tickets) {
      if (tk.status !== "pending" && tk.status !== "preparing") continue;
      const k = groupKey(tk);
      const list = g.get(k) ?? [];
      list.push(tk);
      g.set(k, list);
    }
    return g;
  }, [tickets]);

  const pastGroups = useMemo(() => {
    const g = new Map<string, KitchenTicket[]>();
    for (const tk of tickets) {
      if (tk.status !== "ready") continue;
      const k = groupKey(tk);
      const list = g.get(k) ?? [];
      list.push(tk);
      g.set(k, list);
    }
    for (const list of g.values()) {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return [...g.entries()].sort((a, b) => {
      const maxA = Math.max(...a[1].map((t) => new Date(t.createdAt).getTime()));
      const maxB = Math.max(...b[1].map((t) => new Date(t.createdAt).getTime()));
      return maxB - maxA;
    });
  }, [tickets]);

  useEffect(() => {
    const activeKeys = new Set(activeGroups.keys());
    setCheckedByGroup((prev) => {
      const next: Record<string, Record<string, number>> = {};
      let changed = false;
      for (const [k, v] of Object.entries(prev)) {
        if (activeKeys.has(k)) next[k] = v;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [activeGroups]);

  useEffect(() => {
    for (const [key, list] of activeGroups.entries()) {
      if (autoReadyLocks.current.has(key)) continue;
      const merged = mergeItems(list);
      const totalQty = merged.reduce((n, i) => n + i.qty, 0);
      const checked = checkedByGroup[key] ?? {};
      const checkedQty = merged.reduce((n, i) => {
        const itemKey = `${i.productId}-${i.name}`;
        return n + Math.min(i.qty, checked[itemKey] ?? 0);
      }, 0);
      if (totalQty > 0 && checkedQty >= totalQty) {
        autoReadyLocks.current.add(key);
        void (async () => {
          try {
            await markGroupReady(list.map((t) => t.id));
          } finally {
            autoReadyLocks.current.delete(key);
            setCheckedByGroup((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          }
        })();
      }
    }
  }, [activeGroups, checkedByGroup, markGroupReady]);

  if (loadError === "forbidden") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-950">
        <p className="font-bold">Sin permiso para cocina</p>
        <p className="mt-2 text-amber-900">
          Tu usuario no tiene la función «Pantalla cocina (KDS)». Pídele a un administrador que la active en Equipo o
          asigne un rol con acceso a cocina.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[min(70dvh,560px)] flex-col gap-3">
      {!audioEnabled && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <p className="text-xs font-bold text-amber-900">
            Activa el sonido para escuchar alertas de nuevas comandas
          </p>
          <button
            type="button"
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-amber-700"
            onClick={enableAudio}
          >
            Activar sonido
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
      <section className="min-h-0 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">
            {es.kds.prepTitle}
          </h3>
          {activeGroups.size > 0 && (
            <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[0.6rem] font-extrabold text-orange-800">
              {activeGroups.size} en prep.
            </span>
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...activeGroups.entries()].map(([key, list]) => {
            const label = displayLabel(list[0]);
            const channelLabel =
              list[0].channel === "table" ? es.kds.channelTable : es.kds.channelCounter;
            const merged = mergeItems(list);
            const oldest = oldestCreatedAt(list);
            const mins = oldest ? minutesBetween(oldest, now) : null;
            const { wrap, delay } = timeAccent(mins);
            const ids = list.map((t) => t.id);
            const checked = checkedByGroup[key] ?? {};
            const totalQty = merged.reduce((n, i) => n + i.qty, 0);
            const checkedQty = merged.reduce((n, i) => {
              const itemKey = `${i.productId}-${i.name}`;
              return n + Math.min(i.qty, checked[itemKey] ?? 0);
            }, 0);

            return (
              <article
                key={key}
                className={`flex flex-col rounded-xl p-3 transition-colors ${wrap}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-black text-slate-900">{label}</p>
                    <p className="text-[0.65rem] font-semibold uppercase text-slate-500">
                      {channelLabel} ·{" "}
                      {es.kds.pedidosCount.replace("{count}", String(list.length))}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-slate-600">
                      {oldest ? fmt(oldest) : ""}
                      {mins != null ? ` · ${es.kds.minElapsed.replace("{n}", String(mins))}` : ""}
                    </p>
                    <p className="mt-1 text-[0.7rem] font-bold text-slate-700">
                      Listos: {checkedQty}/{totalQty}
                    </p>
                    {delay && (
                      <p className="mt-1 text-[0.7rem] font-extrabold uppercase tracking-wide text-red-700">
                        {es.kds.ordenConDemora}
                      </p>
                    )}
                  </div>
                </div>
                <ul className="mt-2 max-h-48 flex-1 space-y-1 overflow-y-auto text-sm font-semibold text-slate-800">
                  {merged.map((i) => (
                    <li key={`${i.productId}-${i.name}`}>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between rounded-lg border px-2 py-1 text-left ${
                          (checked[`${i.productId}-${i.name}`] ?? 0) >= i.qty
                            ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                        onClick={() =>
                          markItemReady(key, `${i.productId}-${i.name}`, i.qty)
                        }
                      >
                        <span>
                          <span className="tabular-nums text-emerald-800">{i.qty}×</span> {i.name}
                        </span>
                        <span className="text-[0.68rem] font-extrabold tabular-nums">
                          {Math.min(i.qty, checked[`${i.productId}-${i.name}`] ?? 0)}/{i.qty}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={kdsBusy}
                  className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  onClick={() => void markGroupReady(ids)}
                >
                  {kdsBusy ? "…" : es.kds.listo}
                </button>
              </article>
            );
          })}
        </div>
        {activeGroups.size === 0 && (
          <p className="mt-6 rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
            {es.kds.emptyPrep}
          </p>
        )}
      </section>

      <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm lg:w-80 xl:w-96">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">
            {es.kds.pastTitle}
          </h3>
          {pastGroups.length > 0 && (
            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[0.6rem] font-extrabold text-white">
              {pastGroups.length} completado{pastGroups.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <ul className="mt-2 max-h-[min(60dvh,520px)] space-y-2 overflow-y-auto">
          {pastGroups.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
              {es.kds.emptyPast}
            </li>
          )}
          {pastGroups.map(([key, list]) => {
            const label = displayLabel(list[0]);
            const open = expandedPast[key] ?? false;
            const merged = mergeItems(list);
            const ids = list.map((t) => t.id);
            return (
              <li key={key} className="rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{label}</p>
                    <p className="text-[0.65rem] text-slate-500">
                      {es.kds.pedidosCount.replace("{count}", String(list.length))} ·{" "}
                      {fmt(list[0].createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-slate-200 px-2 py-1 text-[0.65rem] font-bold text-slate-600 hover:bg-slate-50"
                    onClick={() =>
                      setExpandedPast((prev) => ({ ...prev, [key]: !open }))
                    }
                  >
                    {open ? es.kds.colapsar : es.kds.expandir}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={kdsBusy}
                  className="mt-2 w-full rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[0.65rem] font-extrabold uppercase tracking-wide text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
                  onClick={() => void returnGroupToPreparing(ids)}
                >
                  Regresar a preparación
                </button>
                {open && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="text-[0.6rem] font-bold uppercase text-slate-400">Total acumulado</p>
                    <ul className="mt-1 list-inside list-disc text-slate-800">
                      {merged.map((i) => (
                        <li key={`p-${i.productId}-${i.name}`}>
                          {i.qty}× {i.name}
                        </li>
                      ))}
                    </ul>
                    {list.length > 1 && (
                      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                        <p className="text-[0.6rem] font-bold uppercase text-slate-400">Por envío</p>
                        {list.map((tk) => (
                          <div key={tk.id} className="rounded bg-slate-50 px-2 py-1">
                            <p className="text-[0.6rem] font-mono text-slate-500">{fmt(tk.createdAt)}</p>
                            <ul className="text-[0.65rem]">
                              {tk.items.map((i) => (
                                <li key={`${tk.id}-${i.productId}`}>
                                  {i.qty}× {i.name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </aside>
      </div>
    </div>
  );
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
