"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DiningTable, KitchenTicket, RoleName } from "@/lib/types";
import { es } from "@/lib/locale";
import { TableFloorMap } from "@/lib/components/TableFloorMap";
import { RestaurantOrderSidebar } from "@/lib/components/RestaurantOrderSidebar";
import { OpenTableModal } from "@/lib/components/OpenTableModal";
import {
  loadTableAssignments,
  removeTableAssignment,
  upsertTableAssignment,
  type TableAssignment,
} from "@/lib/table-assignments";
import { LayoutGrid, Store } from "lucide-react";

type SubTab = "mesas" | "mostrador";

export type RestaurantCurrentUser = {
  id: string;
  fullName: string;
  role: RoleName;
};

type Props = {
  tables: DiningTable[];
  currentUser: RestaurantCurrentUser;
  /** Permiso `favorites.manage` (solo rol admin por defecto). */
  canConfigureFavorites?: boolean;
};

type TableSession = { tableId: string; clientName: string; customerId: string | null };

type CounterOrder = {
  id: string;
  status: "preparing" | "delivered";
  createdAt: string;
};

export function RestaurantPageClient({
  tables,
  currentUser,
  canConfigureFavorites = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sub, setSub] = useState<SubTab>("mesas");
  const [session, setSession] = useState<TableSession | null>(null);
  const [modalTableId, setModalTableId] = useState<string | null>(null);
  const [mesaFilter, setMesaFilter] = useState("");
  const [assignments, setAssignments] = useState<Record<string, TableAssignment>>({});
  const [counterOrders, setCounterOrders] = useState<CounterOrder[]>([]);
  const [activeCounterId, setActiveCounterId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState<boolean | null>(null);
  const [kitchenTickets, setKitchenTickets] = useState<KitchenTicket[]>([]);
  /** En móvil: alternar plano de mesas o panel de pedido a pantalla completa. */
  const [mobileMesasPane, setMobileMesasPane] = useState<"floor" | "order">("floor");
  const prevSessionTableRef = useRef<string | null>(null);

  const syncAssignments = useCallback(() => {
    setAssignments(loadTableAssignments());
  }, []);

  useEffect(() => {
    syncAssignments();
    window.addEventListener("pos-table-assignments-updated", syncAssignments);
    return () => window.removeEventListener("pos-table-assignments-updated", syncAssignments);
  }, [syncAssignments]);

  const refreshRegister = useCallback(() => {
    fetch("/api/register/status")
      .then((r) => r.json())
      .then((d) => setRegisterOpen(!!d.data?.isOpen))
      .catch(() => setRegisterOpen(false));
  }, []);

  useEffect(() => {
    refreshRegister();
    window.addEventListener("pos-register-updated", refreshRegister);
    return () => window.removeEventListener("pos-register-updated", refreshRegister);
  }, [refreshRegister]);

  const refreshKitchen = useCallback(() => {
    fetch("/api/kitchen/tickets")
      .then((r) => r.json())
      .then((d) => setKitchenTickets((d.data as KitchenTicket[]) ?? []))
      .catch(() => setKitchenTickets([]));
  }, []);

  useEffect(() => {
    refreshKitchen();
    window.addEventListener("pos-kitchen-updated", refreshKitchen);
    return () => window.removeEventListener("pos-kitchen-updated", refreshKitchen);
  }, [refreshKitchen]);

  const syncUrl = useCallback(
    (tableId: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (tableId) next.set("mesa", tableId);
      else next.delete("mesa");
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const m = searchParams.get("mesa");
    if (!m || !tables.some((t) => t.id === m)) return;

    const map = loadTableAssignments();
    const a = map[m];

    if (a) {
      setSession({ tableId: m, clientName: a.clientName, customerId: a.customerId ?? null });
      setModalTableId(null);
    } else {
      setModalTableId(m);
    }
  }, [searchParams, tables, syncUrl]);

  const activeVisualId = modalTableId ?? session?.tableId ?? null;

  useEffect(() => {
    if (sub !== "mesas") return;
    const id = session?.tableId ?? null;
    if (!id) {
      setMobileMesasPane("floor");
      prevSessionTableRef.current = null;
      return;
    }
    if (prevSessionTableRef.current !== id) {
      setMobileMesasPane("order");
      prevSessionTableRef.current = id;
    }
  }, [session?.tableId, sub]);

  const onTablePress = useCallback(
    (id: string) => {
      if (session?.tableId === id) {
        syncUrl(id);
        return;
      }
      const existing = loadTableAssignments()[id];

      if (existing) {
        setSession({
          tableId: id,
          clientName: existing.clientName,
          customerId: existing.customerId ?? null,
        });
        setModalTableId(null);
        syncUrl(id);
        return;
      }
      setModalTableId(id);
    },
    [session?.tableId, syncUrl],
  );

  const confirmOpenTable = useCallback(
    (clientName: string, customerId: string | null) => {
      if (!modalTableId) return;
      upsertTableAssignment(modalTableId, {
        serverId: currentUser.id,
        serverName: currentUser.fullName,
        clientName,
        customerId,
      });
      syncAssignments();
      setSession({ tableId: modalTableId, clientName, customerId });
      setModalTableId(null);
      syncUrl(modalTableId);
    },
    [currentUser.fullName, currentUser.id, modalTableId, syncAssignments, syncUrl],
  );

  const closeTable = useCallback(async () => {
    const currentTableId = session?.tableId ?? null;
    if (currentTableId) {
      try {
        const res = await fetch("/api/kitchen/tickets");
        const data = await res.json().catch(() => ({}));
        const tickets = Array.isArray(data?.data) ? data.data : [];
        const pendingIds = tickets
          .filter(
            (t: { id: string; tableId: string | null; status: string }) =>
              t.tableId === currentTableId && t.status !== "ready",
          )
          .map((t: { id: string }) => t.id);
        for (const id of pendingIds) {
          await fetch(`/api/kitchen/tickets/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ready" }),
          });
        }
        if (pendingIds.length > 0) {
          window.dispatchEvent(new CustomEvent("pos-kitchen-updated"));
        }
      } catch {
        // Best effort: if kitchen update fails, still allow table close.
      }
      removeTableAssignment(currentTableId);
      syncAssignments();
    }
    setSession(null);
    setModalTableId(null);
    syncUrl(null);
  }, [session?.tableId, syncAssignments, syncUrl]);

  const selectedTableEntity = session
    ? tables.find((t) => t.id === session.tableId) ?? null
    : null;

  const modalTable = modalTableId
    ? tables.find((t) => t.id === modalTableId) ?? null
    : null;

  const mesaHits = useMemo(() => {
    const q = mesaFilter.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q),
    );
  }, [mesaFilter, tables]);

  const assignmentMap = useMemo(() => {
    const m: Record<string, TableAssignment | undefined> = {};
    for (const [k, v] of Object.entries(assignments)) {
      m[k] = v;
    }
    return m;
  }, [assignments]);

  const kitchenByTable = useMemo(() => {
    const map: Record<string, { status: "free" | "pending" | "ready"; oldestAt: string | null }> = {};
    for (const [tableId, a] of Object.entries(assignments)) {
      map[tableId] = { status: "pending", oldestAt: a.openedAt ?? null };
    }
    const grouped: Record<string, KitchenTicket[]> = {};
    for (const t of kitchenTickets) {
      if (!t.tableId) continue;
      grouped[t.tableId] = grouped[t.tableId] ? [...grouped[t.tableId], t] : [t];
    }
    for (const [tableId, tickets] of Object.entries(grouped)) {
      const notReady = tickets.filter((x) => x.status !== "ready");
      const ready = tickets.filter((x) => x.status === "ready");
      const pickOldest = (list: KitchenTicket[]) =>
        list.reduce<string | null>((oldest, item) => {
          if (!oldest) return item.createdAt;
          return new Date(item.createdAt).getTime() < new Date(oldest).getTime() ? item.createdAt : oldest;
        }, null);
      if (notReady.length > 0) {
        map[tableId] = { status: "pending", oldestAt: pickOldest(notReady) };
      } else if (ready.length > 0) {
        map[tableId] = { status: "ready", oldestAt: pickOldest(ready) };
      }
    }
    return map;
  }, [kitchenTickets, assignments]);

  return (
    <div className="flex max-h-[calc(100dvh-7rem)] min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:min-h-0 lg:max-h-[calc(100dvh-4.25rem)]">
      {modalTable && (
        <OpenTableModal
          table={modalTable}
          onConfirm={confirmOpenTable}
          onCancel={() => {
            setModalTableId(null);
            if (!session) syncUrl(null);
          }}
        />
      )}
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-600 bg-slate-700 px-2 py-1.5"
        role="tablist"
        aria-label="Vista restaurante"
      >
        <button
          type="button"
          role="tab"
          aria-selected={sub === "mesas"}
          onClick={() => setSub("mesas")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide transition-colors ${
            sub === "mesas"
              ? "bg-white text-slate-900"
              : "text-slate-200 hover:bg-slate-600/80 hover:text-white"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          {es.restaurant.subMesas}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sub === "mostrador"}
          onClick={() => {
            setSub("mostrador");
            setModalTableId(null);
            if (!session) syncUrl(null);
          }}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide transition-colors ${
            sub === "mostrador"
              ? "bg-white text-slate-900"
              : "text-slate-200 hover:bg-slate-600/80 hover:text-white"
          }`}
        >
          <Store className="h-3.5 w-3.5" />
          {es.restaurant.subCounter}
        </button>
        {sub === "mesas" && (
          <div className="ml-auto flex min-w-[120px] max-w-[220px] flex-1 sm:max-w-xs">
            <input
              type="search"
              placeholder={es.restaurant.goToTable}
              className="w-full rounded-md border-0 bg-slate-600 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-400 focus:ring-2 focus:ring-white/30"
              value={mesaFilter}
              onChange={(e) => setMesaFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || mesaHits.length === 0) return;
                const q = mesaFilter.trim().toLowerCase();
                const exact = mesaHits.find((t) => t.label.toLowerCase() === q);
                onTablePress((exact ?? mesaHits[0]).id);
                setMesaFilter("");
              }}
              list="mesa-suggestions"
            />
            <datalist id="mesa-suggestions">
              {mesaHits.map((t) => (
                <option key={t.id} value={t.label} />
              ))}
            </datalist>
          </div>
        )}
      </div>

      {sub === "mesas" && (
        <div
          className="flex gap-1 border-b border-slate-200 bg-slate-100 px-2 py-1 lg:hidden"
          role="tablist"
          aria-label={es.restaurant.subMesas}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobileMesasPane === "floor"}
            onClick={() => setMobileMesasPane("floor")}
            className={`min-h-9 flex-1 rounded-md px-2 py-1.5 text-[0.65rem] font-extrabold uppercase tracking-wide ${
              mobileMesasPane === "floor"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-white/70"
            }`}
          >
            {es.restaurant.mobileTabFloor}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileMesasPane === "order"}
            onClick={() => setMobileMesasPane("order")}
            className={`min-h-9 flex-1 rounded-md px-2 py-1.5 text-[0.65rem] font-extrabold uppercase tracking-wide ${
              mobileMesasPane === "order"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-white/70"
            }`}
          >
            {es.restaurant.mobileTabOrder}
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:items-stretch">
        <div
          className={`flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden border-b border-slate-200 max-lg:min-h-0 max-lg:flex-1 lg:max-h-full lg:min-h-0 lg:flex-[9] lg:border-b-0 lg:border-r ${
            sub === "mesas" && mobileMesasPane === "order" ? "max-lg:hidden" : ""
          }`}
        >
          {sub === "mesas" ? (
            <TableFloorMap
              tables={tables}
              embedded
              selectedTableId={activeVisualId}
              onSelectTable={onTablePress}
              assignments={assignmentMap}
              kitchenByTable={kitchenByTable}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2 bg-slate-50/80 p-3">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-xs font-extrabold uppercase text-white shadow"
                style={{ backgroundColor: "var(--pos-primary)" }}
                onClick={() => {
                  if (registerOpen === null) return;
                  if (registerOpen === false) {
                    window.alert(
                      `${es.orderFlow.mustOpenRegisterBeforeOperations}\n\n${es.orderFlow.openRegisterLink}`,
                    );
                    return;
                  }
                  const id = `co_${Date.now()}`;
                  setCounterOrders((o) => [
                    { id, status: "preparing", createdAt: new Date().toISOString() },
                    ...o,
                  ]);
                  setActiveCounterId(id);
                }}
              >
                {es.orderFlow.newCounterSale}
              </button>
              <p className="text-[0.65rem] font-extrabold uppercase text-slate-500">
                {es.orderFlow.counterQueueTitle}
              </p>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {counterOrders.map((o) => (
                  <div
                    key={o.id}
                    className={`rounded-lg border bg-white p-2 text-xs shadow-sm ${
                      activeCounterId === o.id ? "ring-2 ring-[var(--pos-primary)]" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[0.6rem] text-slate-500">{o.id}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.55rem] font-bold ${
                          o.status === "preparing"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-emerald-100 text-emerald-900"
                        }`}
                      >
                        {o.status === "preparing" ? es.orderFlow.preparing : es.orderFlow.delivered}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[0.6rem] font-bold"
                        onClick={() => {
                          if (registerOpen === null) return;
                          if (registerOpen === false) {
                            window.alert(
                              `${es.orderFlow.mustOpenRegisterBeforeOperations}\n\n${es.orderFlow.openRegisterLink}`,
                            );
                            return;
                          }
                          setActiveCounterId(o.id);
                        }}
                      >
                        {es.orderFlow.continueSale}
                      </button>
                      {o.status === "preparing" && (
                        <button
                          type="button"
                          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[0.6rem] font-bold text-emerald-800"
                          onClick={() =>
                            setCounterOrders((list) =>
                              list.map((x) =>
                                x.id === o.id ? { ...x, status: "delivered" as const } : x,
                              ),
                            )
                          }
                        >
                          {es.orderFlow.markDelivered}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {counterOrders.length === 0 && (
                  <p className="text-center text-sm text-slate-500">{es.orderFlow.selectCounter}</p>
                )}
              </div>
            </div>
          )}
        </div>
        <div
          className={`flex h-full min-h-0 max-h-full w-full min-w-0 flex-1 flex-col overflow-hidden border-t border-slate-200 lg:min-h-0 lg:min-w-[340px] lg:border-l lg:border-t-0 lg:flex-[7] ${
            sub === "mesas" && mobileMesasPane === "floor" ? "max-lg:hidden" : ""
          }`}
        >
          <RestaurantOrderSidebar
            mode={sub === "mostrador" ? "counter" : "table"}
            table={sub === "mostrador" ? null : selectedTableEntity}
            counterOrderId={sub === "mostrador" ? activeCounterId : null}
            tableLabelForKitchen={
              sub === "mostrador" ? (activeCounterId ? `Mostrador ${activeCounterId.slice(-6)}` : "Mostrador") : selectedTableEntity?.label ?? ""
            }
            clientName={sub === "mostrador" ? null : session?.clientName ?? null}
            customerId={sub === "mostrador" ? null : session?.customerId ?? null}
            serverName={
              sub === "mostrador"
                ? currentUser.fullName
                : session
                  ? assignments[session.tableId]?.serverName ?? null
                  : null
            }
            billingServerId={
              sub === "mostrador" || !session
                ? currentUser.id
                : assignments[session.tableId]?.serverId ?? currentUser.id
            }
            billingServerName={
              sub === "mostrador" || !session
                ? currentUser.fullName
                : assignments[session.tableId]?.serverName ?? currentUser.fullName
            }
            onCloseTable={closeTable}
            canConfigureFavorites={canConfigureFavorites}
          />
        </div>
      </div>
    </div>
  );
}
