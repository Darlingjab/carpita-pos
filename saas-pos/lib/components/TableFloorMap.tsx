"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DiningTable } from "@/lib/types";
import type { TableAssignment } from "@/lib/table-assignments";
import {
  defaultGridState,
  loadGridState,
  moveTableToCell,
  saveGridState,
  type GridFloorState,
} from "@/lib/table-grid-layout";
import { es } from "@/lib/locale";
import { RotateCcw } from "lucide-react";

type Props = {
  tables: DiningTable[];
  embedded?: boolean;
  selectedTableId?: string | null;
  onSelectTable?: (id: string) => void;
  assignments?: Record<string, TableAssignment | undefined>;
  kitchenByTable?: Record<string, { status: "free" | "pending" | "ready"; oldestAt: string | null }>;
};

function waitLabel(oldestAt: string | null, nowMs: number) {
  if (!oldestAt) return "0m";
  const diff = Math.max(0, nowMs - new Date(oldestAt).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

/** Minutos transcurridos desde que se abrió la mesa */
function minsOpen(openedAt: string | null | undefined, nowMs: number): number {
  if (!openedAt) return 0;
  return Math.max(0, Math.floor((nowMs - new Date(openedAt).getTime()) / 60000));
}

function pointerToCell(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  cols: number,
  rows: number,
) {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const col = Math.min(cols - 1, Math.max(0, Math.floor(x * cols)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor(y * rows)));
  return { row, col };
}

export function TableFloorMap({
  tables,
  embedded = false,
  selectedTableId = null,
  onSelectTable,
  assignments = {},
  kitchenByTable = {},
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [grid, setGrid] = useState<GridFloorState>(() => defaultGridState(tables));
  const [resetConfirm, setResetConfirm] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const gridLive = useRef(grid);
  gridLive.current = grid;
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);

  useEffect(() => {
    setGrid(loadGridState(tables));
  }, [tables]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const persist = useCallback((next: GridFloorState) => {
    setGrid(next);
    saveGridState(next);
  }, []);

  const handleReset = () => {
    setResetConfirm(true);
  };

  const executeReset = () => {
    setResetConfirm(false);
    persist(defaultGridState(tables));
  };

  const endDrag = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId || !gridRef.current) return;
      dragRef.current = null;
      const g = gridLive.current;
      const rect = gridRef.current.getBoundingClientRect();
      const { row, col } = pointerToCell(e.clientX, e.clientY, rect, g.cols, g.rows);
      const next = moveTableToCell(g, d.id, row, col, tables);
      persist(next);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    },
    [persist, tables],
  );

  const startArrangeDrag = (tableId: string, e: React.PointerEvent) => {
    if (!arrangeMode) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { id: tableId, pointerId: e.pointerId };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  };

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col ${embedded ? "gap-1.5 p-1.5 sm:gap-2 sm:p-3" : "gap-4"}`}
    >
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              className="text-xl font-black tracking-tight text-slate-900"
              style={{ letterSpacing: "-0.02em" }}
            >
              {es.mesas.title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{es.mesas.hint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setArrangeMode((v) => !v)}
              className={`rounded-lg px-4 py-2 text-xs font-extrabold uppercase tracking-wide shadow-sm transition-colors ${
                arrangeMode ? "text-white" : "border bg-white text-slate-800"
              }`}
              style={
                arrangeMode
                  ? { backgroundColor: "var(--pos-primary)" }
                  : { borderColor: "var(--pos-border)" }
              }
            >
              {arrangeMode ? es.mesas.viewMode : es.mesas.arrangeMode}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700"
              style={{ borderColor: "var(--pos-border)" }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {es.mesas.resetLayout}
            </button>
            {!onSelectTable && (
              <Link
                href="/pos"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-slate-800 shadow-sm hover:bg-slate-50"
              >
                {es.mesas.counterShortcut}
              </Link>
            )}
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setArrangeMode((v) => !v)}
            className={`rounded-md px-2 py-1 text-[0.6rem] font-extrabold uppercase tracking-wide sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-[0.65rem] ${
              arrangeMode ? "text-white" : "border bg-white text-slate-800"
            }`}
            style={
              arrangeMode
                ? { backgroundColor: "var(--pos-primary)" }
                : { borderColor: "var(--pos-border)" }
            }
          >
            {arrangeMode ? es.mesas.viewMode : es.mesas.arrangeMode}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-0.5 rounded-md border bg-white px-2 py-1 text-[0.6rem] font-bold text-slate-700 sm:gap-1 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-[0.65rem]"
            style={{ borderColor: "var(--pos-border)" }}
          >
            <RotateCcw className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            {es.mesas.resetLayout}
          </button>
        </div>
      )}

      {arrangeMode && (
        <div
          className="rounded-lg border px-3 py-2 text-xs font-semibold text-amber-900"
          style={{
            background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
            borderColor: "#fcd34d",
          }}
        >
          {es.restaurant.arrangeGridHint}
        </div>
      )}

      <div
        ref={gridRef}
        className="grid min-h-0 flex-1 gap-1 rounded-xl border p-1"
        style={{
          gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
          backgroundColor: "#eef1f6",
          borderColor: "rgb(15 23 42 / 0.1)",
          backgroundImage: `radial-gradient(circle at 1.5px 1.5px, rgb(15 23 42 / 0.10) 1.5px, transparent 0)`,
          backgroundSize: "24px 24px",
          boxShadow: "inset 0 2px 16px rgb(15 23 42 / 0.07)",
        }}
      >
        {tables.map((t) => {
          const cell = grid.cells[t.id];
          if (!cell) return null;
          const assign = assignments[t.id];
          const waiter = assign?.serverName ?? es.restaurant.waiterUnassigned;
          const kitchen = kitchenByTable[t.id];
          // Estado real de la mesa:
          // "free"    → sin asignación (libre)
          // "open"    → asignada pero sin pedidos en cocina
          // "pending" → cocina cocinando (pedidos pendientes)
          // "ready"   → cocina lista, mesa a punto de cerrar
          const tableState: "free" | "open" | "pending" | "ready" = !assign
            ? "free"
            : !kitchen
              ? "open"
              : kitchen.status === "ready"
                ? "ready"
                : kitchen.status === "pending" || kitchen.status === "free"
                  ? (kitchen.status === "free" ? "open" : "pending")
                  : "pending";
          const waiting = waitLabel(kitchen?.oldestAt ?? assign?.openedAt ?? null, nowMs);
          const selected = selectedTableId === t.id;
          const shapeClass = "rounded-lg";
          const openMins = minsOpen(assign?.openedAt, nowMs);
          // Alerta de tiempo: ring naranja >90 min, ring rojo >120 min
          const timeAlert = assign && openMins >= 120
            ? "ring-2 ring-red-600 ring-offset-1"
            : assign && openMins >= 90
              ? "ring-2 ring-orange-500 ring-offset-1"
              : "";

          const statusClasses = selected
            ? "ring-[3px] ring-blue-500 ring-offset-2 ring-offset-[#eef1f6] shadow-xl border-blue-400 bg-blue-50 text-blue-950 scale-105"
            : tableState === "pending"
              ? "border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 text-orange-950 shadow-[0_3px_10px_rgb(251_146_60/0.35)]"
              : tableState === "ready"
                ? "border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 text-amber-950 shadow-[0_3px_10px_rgb(251_191_36/0.35)]"
                : tableState === "open"
                  ? "border-sky-300 bg-gradient-to-br from-sky-50 to-white text-sky-950 shadow-[0_2px_8px_rgb(56_189_248/0.22)]"
                  : "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white text-emerald-950 shadow-[0_2px_6px_rgb(34_197_94/0.18)]";

          const shapeRound = cell.shape === "round";
          const inner = (
            <div
              className={`flex h-[min(3.5rem,20vw)] w-[min(3.5rem,20vw)] shrink-0 flex-col items-center justify-center border-2 px-0.5 py-0.5 text-center transition-[transform,box-shadow,filter] duration-150 sm:h-[min(4.25rem,18vw)] sm:w-[min(4.25rem,18vw)] sm:py-1 ${
                shapeRound ? "rounded-full" : shapeClass
              } ${statusClasses} ${timeAlert} ${
                arrangeMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer hover:scale-[1.04] hover:brightness-[1.03] active:scale-[0.98]"
              }`}
              style={{ margin: "auto" }}
              onPointerDown={(e) => startArrangeDrag(t.id, e)}
            >
              <span className="text-[0.66rem] font-black tabular-nums leading-none sm:text-[0.74rem]">
                {t.label}
              </span>
              <span className="mt-0.5 line-clamp-1 max-w-full px-0.5 text-[0.62rem] font-semibold leading-none opacity-90 sm:text-[0.65rem]" title={waiter}>
                {waiter}
              </span>
              <span className={`mt-0.5 rounded px-1 py-0.5 text-[0.6rem] font-extrabold leading-none sm:text-[0.62rem] ${
                tableState === "free" ? "bg-emerald-200/70 text-emerald-900" :
                tableState === "open" ? "bg-sky-200/70 text-sky-900" :
                tableState === "pending" ? "bg-orange-200/70 text-orange-900" :
                "bg-amber-200/70 text-amber-900"
              }`}>
                {tableState === "free" ? "Libre" :
                 tableState === "open" ? waiting :
                 tableState === "ready" ? "✓ Lista" :
                 `🍳 ${waiting}`}
              </span>
              {arrangeMode && (
                <span className="mt-0.5 rounded bg-white/90 px-1 py-0.5 text-[0.62rem] font-extrabold uppercase text-slate-700 shadow">
                  {es.mesas.arrangeMode}
                </span>
              )}
            </div>
          );

          const tile =
            arrangeMode ? (
              inner
            ) : onSelectTable ? (
              <button
                type="button"
                className="flex min-h-0 min-w-0 items-center justify-center border-0 bg-transparent p-0.5"
                onClick={() => onSelectTable(t.id)}
              >
                {inner}
              </button>
            ) : (
              <Link
                href={`/pos?mesa=${encodeURIComponent(t.id)}`}
                className="flex min-h-0 min-w-0 items-center justify-center p-0.5"
              >
                {inner}
              </Link>
            );

          return (
            <div
              key={t.id}
              className="flex min-h-0 min-w-0 items-center justify-center"
              style={{
                gridColumn: cell.col + 1,
                gridRow: cell.row + 1,
              }}
            >
              {tile}
            </div>
          );
        })}
      </div>
      {resetConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-sm font-black text-slate-900">Restaurar disposición</h3>
            <p className="mt-1.5 text-sm text-slate-600">
              ¿Restaurar el plano en cuadrícula por defecto? Se perderá la disposición guardada.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => setResetConfirm(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-extrabold text-white hover:bg-red-700"
                onClick={executeReset}
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Leyenda de colores */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 border-t px-3 py-2" style={{ backgroundColor: "#f5f7fa", borderColor: "rgb(15 23 42 / 0.08)" }}>
        {([
          { dot: "bg-emerald-400", label: "Libre" },
          { dot: "bg-sky-400", label: "Abierta" },
          { dot: "bg-orange-400", label: "Cocinando" },
          { dot: "bg-amber-400", label: "Lista" },
        ] as const).map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[0.6rem] font-semibold text-slate-500">
            <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-3 text-[0.6rem] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full border-2 border-orange-500" />
            &gt;90 min
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full border-2 border-red-600" />
            &gt;2 h
          </span>
        </span>
      </div>
    </section>
  );
}
