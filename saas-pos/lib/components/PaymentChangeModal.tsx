"use client";

import { useMemo, useState } from "react";
import { es } from "@/lib/locale";

type Props = {
  total: number;
  paymentMethod: "cash" | "card";
  onConfirm: (tenderedCash: number | null) => void;
  onSplit?: () => void;
  onClose: () => void;
};

export function PaymentChangeModal({
  total,
  paymentMethod,
  onConfirm,
  onSplit,
  onClose,
}: Props) {
  const [tendered, setTendered] = useState("");

  const tenderNum = Math.max(0, Number(tendered) || 0);
  const change = useMemo(() => Math.max(0, tenderNum - total), [tenderNum, total]);

  function submit() {
    if (paymentMethod === "card") {
      onConfirm(null);
      return;
    }
    if (tenderNum < total) {
      window.alert(es.paymentModal.insufficient);
      return;
    }
    onConfirm(tenderNum);
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-3">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
        <h2 className="text-base font-black text-slate-900">{es.paymentModal.title}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {es.paymentModal.toPay}: <strong>${total.toFixed(2)}</strong>
        </p>
        {paymentMethod === "cash" ? (
          <>
            <label className="mt-3 block text-xs font-bold text-slate-600">
              {es.paymentModal.tendered}
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-lg font-bold tabular-nums"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              autoFocus
            />
            <div className="mt-3 flex justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
              <span>{es.paymentModal.change}</span>
              <span>${change.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-slate-500">{es.paymentModal.cardNoChange}</p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-bold"
            onClick={onClose}
          >
            {es.restaurant.cancelOpen}
          </button>
          {onSplit && (
            <button
              type="button"
              className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-sm font-bold text-slate-700"
              onClick={onSplit}
            >
              Dividir cuenta
            </button>
          )}
          <button
            type="button"
            className="btn-pos-primary flex-1 py-2 text-sm font-extrabold uppercase"
            onClick={submit}
          >
            {es.paymentModal.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
