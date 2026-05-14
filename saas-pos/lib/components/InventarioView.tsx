"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/lib/components/ConfirmDialog";

const STORAGE_KEY = "pos_inventario_v1";

const UNITS = ["kg", "lt", "und", "paq", "caja", "g", "ml"] as const;
type Unit = (typeof UNITS)[number];

type Insumo = {
  id: string;
  nombre: string;
  unidad: Unit;
  stock: number;
  stockMin: number;
  updatedAt: string;
};

type Ajuste = {
  insumoId: string;
  delta: number;
  nota: string;
};

function loadInventario(): Insumo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Insumo[]) : [];
  } catch {
    return [];
  }
}

function saveInventario(items: Insumo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InventarioView() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [ajusteTarget, setAjusteTarget] = useState<Insumo | null>(null);

  // Form nuevo insumo
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState<Unit>("kg");
  const [stock, setStock] = useState("");
  const [stockMin, setStockMin] = useState("");

  // Form ajuste
  const [ajusteDelta, setAjusteDelta] = useState("");
  const [ajusteNota, setAjusteNota] = useState("");
  const [ajusteTipo, setAjusteTipo] = useState<"in" | "out">("out");

  useEffect(() => {
    setInsumos(loadInventario());
  }, []);

  const persist = (next: Insumo[]) => {
    setInsumos(next);
    saveInventario(next);
  };

  const handleAddInsumo = () => {
    if (!nombre.trim()) return;
    const s = Number(stock);
    const sm = Number(stockMin);
    const newInsumo: Insumo = {
      id: `ins_${Date.now()}`,
      nombre: nombre.trim(),
      unidad,
      stock: Number.isFinite(s) ? s : 0,
      stockMin: Number.isFinite(sm) ? sm : 0,
      updatedAt: new Date().toISOString(),
    };
    persist([...insumos, newInsumo]);
    setNombre("");
    setStock("");
    setStockMin("");
    setShowForm(false);
  };

  const handleAjuste = ({ insumoId, delta, nota }: Ajuste) => {
    const updated = insumos.map((ins) =>
      ins.id === insumoId
        ? { ...ins, stock: Math.max(0, ins.stock + delta), updatedAt: new Date().toISOString() }
        : ins,
    );
    persist(updated);
    // log to localStorage for history
    try {
      const histKey = "pos_inventario_history_v1";
      const hist = JSON.parse(localStorage.getItem(histKey) ?? "[]") as {
        insumoId: string;
        delta: number;
        nota: string;
        at: string;
      }[];
      hist.unshift({ insumoId, delta, nota, at: new Date().toISOString() });
      localStorage.setItem(histKey, JSON.stringify(hist.slice(0, 200)));
    } catch {
      //
    }
    setAjusteTarget(null);
    setAjusteDelta("");
    setAjusteNota("");
  };

  const [deleteInsumoId, setDeleteInsumoId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeleteInsumoId(id);
  };

  const executeDeleteInsumo = (id: string) => {
    setDeleteInsumoId(null);
    persist(insumos.filter((i) => i.id !== id));
  };

  const bajoStock = insumos.filter((i) => i.stock <= i.stockMin && i.stockMin > 0);

  return (
    <div className="space-y-5">
      {/* Alertas de stock bajo */}
      {bajoStock.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-700">
            ⚠️ Stock bajo en {bajoStock.length} insumo{bajoStock.length !== 1 ? "s" : ""}:
          </p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {bajoStock.map((i) => (
              <li
                key={i.id}
                className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800"
              >
                {i.nombre} ({i.stock} {i.unidad})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black text-slate-900">Insumos</h2>
        <button
          type="button"
          className="btn-primary rounded-lg px-4 py-2 text-sm font-bold text-white"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancelar" : "+ Agregar insumo"}
        </button>
      </div>

      {/* Formulario nuevo insumo */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-bold text-slate-600">Nuevo insumo</p>
          <div className="flex flex-wrap gap-3">
            <input
              className="input-base flex-[2] text-sm"
              placeholder="Nombre (ej: Harina)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <select
              className="input-base w-24 text-sm"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value as Unit)}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <input
              className="input-base w-24 text-sm"
              type="number"
              min="0"
              placeholder="Stock"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
            <input
              className="input-base w-24 text-sm"
              type="number"
              min="0"
              placeholder="Mín."
              value={stockMin}
              onChange={(e) => setStockMin(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary rounded-lg px-4 py-2 text-sm font-bold text-white"
              onClick={handleAddInsumo}
            >
              Guardar
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Stock mínimo activa alerta cuando el nivel es igual o menor a ese valor.
          </p>
        </div>
      )}

      {/* Modal ajuste */}
      {ajusteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-black text-slate-900">
              Ajuste: {ajusteTarget.nombre}
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              Stock actual:{" "}
              <strong>
                {ajusteTarget.stock} {ajusteTarget.unidad}
              </strong>
            </p>
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded-lg py-2 text-sm font-bold ${ajusteTipo === "out" ? "bg-red-100 text-red-700 ring-2 ring-red-400" : "bg-slate-100 text-slate-600"}`}
                onClick={() => setAjusteTipo("out")}
              >
                − Salida / merma
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg py-2 text-sm font-bold ${ajusteTipo === "in" ? "bg-green-100 text-green-700 ring-2 ring-green-400" : "bg-slate-100 text-slate-600"}`}
                onClick={() => setAjusteTipo("in")}
              >
                + Entrada
              </button>
            </div>
            <input
              className="input-base mb-3 w-full text-sm"
              type="number"
              min="0"
              step="0.01"
              placeholder={`Cantidad (${ajusteTarget.unidad})`}
              value={ajusteDelta}
              onChange={(e) => setAjusteDelta(e.target.value)}
            />
            <input
              className="input-base mb-4 w-full text-sm"
              placeholder="Motivo (opcional)"
              value={ajusteNota}
              onChange={(e) => setAjusteNota(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setAjusteTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary flex-1 rounded-lg py-2 text-sm font-bold text-white"
                onClick={() => {
                  const delta = Number(ajusteDelta);
                  if (!Number.isFinite(delta) || delta <= 0) return;
                  handleAjuste({
                    insumoId: ajusteTarget.id,
                    delta: ajusteTipo === "in" ? delta : -delta,
                    nota: ajusteNota,
                  });
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      {insumos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400">
          <p className="text-4xl">📦</p>
          <p className="mt-2">No hay insumos en el inventario.</p>
          <p className="mt-1 text-xs">Hacé clic en "+ Agregar insumo" para comenzar.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase text-slate-400">
                <th className="px-4 py-3">Insumo</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Mínimo</th>
                <th className="px-4 py-3">Actualizado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {insumos.map((ins) => {
                const bajo = ins.stockMin > 0 && ins.stock <= ins.stockMin;
                return (
                  <tr key={ins.id} className={bajo ? "bg-amber-50/60" : ""}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {ins.nombre}
                      {bajo && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          BAJO
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {ins.stock} {ins.unidad}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {ins.stockMin} {ins.unidad}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDate(ins.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                          onClick={() => {
                            setAjusteTarget(ins);
                            setAjusteDelta("");
                            setAjusteNota("");
                            setAjusteTipo("out");
                          }}
                        >
                          Ajustar
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-red-100 px-2 py-1 text-xs font-bold text-red-400 hover:bg-red-50"
                          onClick={() => handleDelete(ins.id)}
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={deleteInsumoId !== null}
        title="Eliminar insumo"
        message="¿Eliminar este insumo del inventario? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={() => { if (deleteInsumoId) executeDeleteInsumo(deleteInsumoId); }}
        onCancel={() => setDeleteInsumoId(null)}
      />
    </div>
  );
}
