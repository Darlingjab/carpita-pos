"use client";

import { useCallback, useEffect, useState } from "react";
import type { RegisterMovement } from "@/lib/types";

const CATEGORIAS = [
  { value: "Insumos", label: "Insumos" },
  { value: "Operativo", label: "Operativo" },
  { value: "Proveedor", label: "Proveedor" },
  { value: "Nómina", label: "Nómina" },
  { value: "Personal", label: "Personal" },
  { value: "Servicios", label: "Servicios" },
  { value: "Mantenimiento", label: "Mantenimiento" },
  { value: "Marketing", label: "Marketing" },
  { value: "Otro", label: "Otro" },
] as const;

type Categoria = (typeof CATEGORIAS)[number]["value"];

const CATEGORY_COLORS: Record<Categoria, string> = {
  Insumos: "bg-green-100 text-green-700",
  Operativo: "bg-blue-100 text-blue-700",
  Proveedor: "bg-purple-100 text-purple-700",
  Nómina: "bg-rose-100 text-rose-700",
  Personal: "bg-yellow-100 text-yellow-700",
  Servicios: "bg-teal-100 text-teal-700",
  Mantenimiento: "bg-orange-100 text-orange-700",
  Marketing: "bg-pink-100 text-pink-700",
  Otro: "bg-slate-100 text-slate-600",
};

function parseMovementNote(note: string | null): { categoria: Categoria; concepto: string } {
  if (!note) return { categoria: "Otro", concepto: "" };
  const match = note.match(/^\[([^\]]+)\] (.+)$/);
  if (match) {
    const cat = match[1] as Categoria;
    return {
      categoria: CATEGORIAS.some((c) => c.value === cat) ? cat : "Otro",
      concepto: match[2],
    };
  }
  return { categoria: "Otro", concepto: note };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GastosPage() {
  const [movements, setMovements] = useState<RegisterMovement[]>([]);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("Insumos");
  const [registerOpen, setRegisterOpen] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<"hoy" | "todo">("todo");

  const fetchMovements = useCallback(async () => {
    try {
      const res = await fetch("/api/register/movements");
      if (!res.ok) return;
      const data = (await res.json()) as { data: RegisterMovement[] };
      setMovements((data.data ?? []).filter((m) => m.type === "out"));
    } catch {
      // silencioso
    }
  }, []);

  const refreshRegister = useCallback(() => {
    fetch("/api/register/status")
      .then((r) => r.json())
      .then((d) => setRegisterOpen(!!d.data?.isOpen))
      .catch(() => setRegisterOpen(false));
  }, []);

  useEffect(() => {
    refreshRegister();
    fetchMovements();
    window.addEventListener("pos-register-updated", refreshRegister);
    return () => window.removeEventListener("pos-register-updated", refreshRegister);
  }, [refreshRegister, fetchMovements]);

  const handleAdd = async () => {
    const m = Number(monto);
    if (!concepto.trim() || !Number.isFinite(m) || m <= 0) {
      setError("Completá el concepto y un monto mayor a 0.");
      return;
    }
    if (registerOpen === false) {
      setError("Abrí la caja antes de registrar gastos.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/register/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "out",
          amount: m,
          note: `[${categoria}] ${concepto.trim()}`,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Error al registrar el gasto.");
        return;
      }
      setConcepto("");
      setMonto("");
      setCategoria("Insumos");
      setFlash("¡Gasto registrado correctamente!");
      setTimeout(() => setFlash(null), 3000);
      await fetchMovements();
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  const filteredMovements = movements.filter((m) => {
    if (dateFilter === "hoy") {
      const d = new Date(m.createdAt);
      const t = new Date();
      return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
    }
    return true;
  });
  const total = filteredMovements.reduce((acc, m) => acc + m.amount, 0);
  const totalPorCategoria = CATEGORIAS.map(({ value }) => ({
    categoria: value,
    total: filteredMovements
      .filter((m) => parseMovementNote(m.note).categoria === value)
      .reduce((acc, m) => acc + m.amount, 0),
  })).filter((c) => c.total > 0);

  return (
    <div className="animate-fade-in space-y-6 p-4 sm:p-6">
      {/* Flash */}
      {flash && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm">
          <span>✓</span> {flash}
        </div>
      )}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Gastos</h1>
          <p className="mt-1 text-sm text-slate-500">Salidas de caja del período</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
            {(["hoy", "todo"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setDateFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold uppercase ${dateFilter === f ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {f === "hoy" ? "Hoy" : "Todo"}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-right">
            <p className="text-xs font-medium text-red-400">Total gastos</p>
            <p className="text-2xl font-black text-red-700">${total.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-700">Nuevo gasto</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Categoría</label>
            <select
              className="input-base w-full text-sm"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as Categoria)}
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-[2]">
            <label className="mb-1 block text-xs font-medium text-slate-500">Concepto</label>
            <input
              className="input-base w-full text-sm"
              placeholder="Ej: Bolsas, gas, electricidad…"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className="w-full sm:w-32">
            <label className="mb-1 block text-xs font-medium text-slate-500">Monto ($)</label>
            <input
              className="input-base w-full text-sm"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <button
            type="button"
            className="btn-primary shrink-0 rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            onClick={handleAdd}
            disabled={loading || registerOpen === null}
          >
            {loading ? "Guardando…" : "Registrar"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        {registerOpen === false && (
          <p className="mt-2 text-sm text-amber-600">
            ⚠️ La caja está cerrada. Abrí la caja para registrar gastos.
          </p>
        )}
      </div>

      {/* Resumen por categoría */}
      {totalPorCategoria.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {totalPorCategoria.map(({ categoria: cat, total: t }) => (
            <span
              key={cat}
              className={`rounded-full px-3 py-1 text-xs font-bold ${CATEGORY_COLORS[cat as Categoria]}`}
            >
              {cat}: ${t.toFixed(2)}
            </span>
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {filteredMovements.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-400">
            <p className="text-4xl">🧾</p>
            <p className="mt-2 text-sm">Sin gastos registrados{dateFilter === "hoy" ? " hoy" : " en esta sesión"}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredMovements.map((m) => {
              const { categoria: cat, concepto: desc } = parseMovementNote(m.note);
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${CATEGORY_COLORS[cat]}`}
                  >
                    {cat}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{desc}</span>
                  <span className="shrink-0 text-xs text-slate-400">{formatDate(m.createdAt)}</span>
                  <span className="shrink-0 font-bold text-red-700">${m.amount.toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
