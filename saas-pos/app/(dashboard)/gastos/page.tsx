"use client";

import { useCallback, useEffect, useState } from "react";
import { LegacySectionStub } from "@/lib/components/LegacySectionStub";
import { es } from "@/lib/locale";

const KEY = "pos_gastos_saas_v1";

type Gasto = { id: string; concepto: string; monto: number; fecha: string };

export default function GastosPage() {
  const [items, setItems] = useState<Gasto[]>([]);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [registerOpen, setRegisterOpen] = useState<boolean | null>(null);

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

  useEffect(() => {
    try {
      const r = localStorage.getItem(KEY);
      setItems(r ? JSON.parse(r) : []);
    } catch {
      setItems([]);
    }
  }, []);

  const persist = (next: Gasto[]) => {
    setItems(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const add = () => {
    if (registerOpen === null) return;
    if (registerOpen === false) {
      window.alert(
        `${es.orderFlow.mustOpenRegisterBeforeOperations}\n\n${es.orderFlow.openRegisterLink}`,
      );
      return;
    }
    const m = Number(monto);
    if (!concepto.trim() || !Number.isFinite(m)) return;
    persist([
      {
        id: `g_${Date.now()}`,
        concepto: concepto.trim(),
        monto: m,
        fecha: new Date().toISOString(),
      },
      ...items,
    ]);
    setConcepto("");
    setMonto("");
  };

  return (
    <LegacySectionStub
      title="Gastos"
      description="Listado local (misma idea que ExpensesView del proyecto anterior). Los datos viven en este navegador hasta conectar backend."
      legacyFile="pages/ExpensesView.jsx"
    >
      <div className="flex max-w-xl flex-col gap-3 sm:flex-row">
        <input
          className="input-base flex-1 text-sm"
          placeholder="Concepto"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
        />
        <input
          className="input-base w-full text-sm sm:w-32"
          type="number"
          placeholder="Monto"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <button type="button" className="btn-primary shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-white" onClick={add}>
          Registrar
        </button>
      </div>
      <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {items.map((g) => (
          <li key={g.id} className="flex justify-between px-4 py-3 text-sm">
            <span>{g.concepto}</span>
            <span className="font-bold text-red-700">${g.monto.toFixed(2)}</span>
          </li>
        ))}
        {items.length === 0 && <li className="px-4 py-8 text-center text-slate-500">Sin gastos registrados</li>}
      </ul>
    </LegacySectionStub>
  );
}
