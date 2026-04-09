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
  return `${mins}m`;
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
    if (
      !window.confirm(
        "¿Restaurar el plano en cuadrícula por defecto? Se perderá la disposición guardada.",
      )
    )
      return;
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
        className="grid min-h-0 flex-1 gap-1 rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-inner"
        style={{
          gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(203 213 225 / 0.55) 1px, transparent 0)`,
          backgroundSize: "22px 22px",
          boxShadow: "inset 0 2px 12px rgb(15 23 42 / 0.06)",
        }}
      >
        {tables.map((t) => {
          const cell = grid.cells[t.id];
          if (!cell) return null;
          const assign = assignments[t.id];
          const waiter = assign?.serverName ?? es.restaurant.waiterUnassigned;
          const kitchen = kitchenByTable[t.id];
          const kStatus = kitchen?.status ?? (!!assign ? "pending" : "free");
          const waiting = waitLabel(kitchen?.oldestAt ?? null, nowMs);
          const selected = selectedTableId === t.id;
          const shapeClass = "rounded-lg";

          const statusClasses = selected
            ? "ring-[3px] ring-amber-400 ring-offset-2 ring-offset-slate-100 shadow-lg"
            : kStatus === "pending"
              ? "border-rose-300 bg-gradient-to-br from-rose-100 to-rose-50 text-rose-950 shadow-md"
              : kStatus === "ready"
                ? "border-amber-300 bg-gradient-to-br from-amber-100 to-amber-50 text-amber-950 shadow-md"
                : "border-emerald-300 bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-950 shadow-md";

          const shapeRound = cell.shape === "round";
          const inner = (
            <div
              className={`flex h-[min(3.5rem,20vw)] w-[min(3.5rem,20vw)] shrink-0 flex-col items-center justify-center border-2 px-0.5 py-0.5 text-center transition-[transform,box-shadow] sm:h-[min(4.25rem,18vw)] sm:w-[min(4.25rem,18vw)] sm:py-1 ${
                shapeRound ? "rounded-full" : shapeClass
              } ${statusClasses} ${
                arrangeMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer hover:brightness-[1.02]"
              }`}
              style={{ margin: "auto" }}
              onPointerDown={(e) => startArrangeDrag(t.id, e)}
            >
              <span className="text-[0.66rem] font-black tabular-nums leading-none sm:text-[0.74rem]">
                {t.label}
              </span>
              <span className="mt-0.5 line-clamp-1 max-w-full px-0.5 text-[0.5rem] font-semibold leading-none opacity-90 sm:text-[0.53rem]" title={waiter}>
                {waiter}
              </span>
              <span className="mt-0.5 rounded bg-white/70 px-1 py-0.5 text-[0.48rem] font-extrabold leading-none text-slate-700 sm:text-[0.5rem]">
                {waiting}
              </span>
              {arrangeMode && (
                <span className="mt-0.5 rounded bg-white/90 px-1 py-0.5 text-[0.5rem] font-extrabold uppercase text-slate-700 shadow">
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
    </section>
  );
}
