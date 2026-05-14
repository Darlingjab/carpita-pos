"use client";

import { useEffect, useMemo, useState } from "react";
import type { Customer, DiningTable } from "@/lib/types";
import { es } from "@/lib/locale";

type Props = {
  table: DiningTable;
  onConfirm: (clientName: string, customerId: string | null) => void;
  onCancel: () => void;
};

export function OpenTableModal({ table, onConfirm, onCancel }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [guests, setGuests] = useState(1);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.data ?? []))
      .catch(() => setCustomers([]));
  }, []);

  const options = useMemo(() => {
    const uniq = new Map<string, Customer>();
    for (const c of customers) {
      uniq.set(c.id, c);
    }
    return [...uniq.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [customers]);

  useEffect(() => {
    if (options.length === 0) return;
    const cf = options.find(
      (c) => c.name.trim().toLowerCase() === es.restaurant.defaultCustomer.trim().toLowerCase(),
    );
    if (cf) {
      setSelectedCustomerId(cf.id);
      return;
    }
    setSelectedCustomerId(options[0].id);
  }, [options]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-table-title"
    >
      <div className="flex max-h-[90dvh] w-full max-w-sm flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
        <h2 id="open-table-title" className="text-lg font-black text-slate-900">
          {es.restaurant.openTableTitle} {table.label}
        </h2>
        <p className="mt-1 text-xs text-slate-500">{es.restaurant.openTableHint}</p>
        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="open-table-customer" className="block text-xs font-bold uppercase text-slate-500">
              Cliente guardado (opcional)
            </label>
            <select
              id="open-table-customer"
              className="input-base mt-1 w-full rounded-lg border px-3 py-2 text-base"
              style={{ borderColor: "var(--pos-border)" }}
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24 shrink-0">
            <label htmlFor="open-table-guests" className="block text-xs font-bold uppercase text-slate-500">
              Comensales
            </label>
            <input
              id="open-table-guests"
              type="number"
              min={1}
              max={20}
              className="input-base mt-1 w-full rounded-lg border px-3 py-2 text-center text-base font-bold"
              style={{ borderColor: "var(--pos-border)" }}
              value={guests}
              onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700"
            onClick={onCancel}
          >
            {es.restaurant.cancelOpen}
          </button>
          <button
            type="button"
            className="btn-pos-primary flex-1 py-2.5 text-sm font-extrabold uppercase"
            onClick={() => {
              const selected = options.find((x) => x.id === selectedCustomerId) ?? null;
              const baseName = selected?.name ?? es.restaurant.defaultCustomer;
              const isDefault =
                baseName.trim().toLowerCase() === es.restaurant.defaultCustomer.trim().toLowerCase();
              const guestSuffix = guests > 1 ? ` · ${guests} p.` : "";
              const name = isDefault ? `${guests} persona${guests !== 1 ? "s" : ""}` : `${baseName}${guestSuffix}`;
              onConfirm(name, isDefault ? null : selected?.id ?? null);
            }}
          >
            {es.restaurant.confirmOpen}
          </button>
        </div>
      </div>
    </div>
  );
}
