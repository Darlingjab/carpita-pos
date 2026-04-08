"use client";

import { AlertTriangle } from "lucide-react";
import { es } from "@/lib/locale";

type Props = {
  amount: number;
  hasBase: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RegisterOpenConfirmModal({ amount, hasBase, onCancel, onConfirm }: Props) {
  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-open-confirm-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"
            aria-hidden
          >
            <AlertTriangle className="h-7 w-7" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h2 id="register-open-confirm-title" className="text-lg font-black text-slate-900">
              {es.registerConfirm.openModalTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {hasBase ? (
                es.registerConfirm.openWithBase.replace("{amount}", `$${amount.toFixed(2)}`)
              ) : (
                es.registerConfirm.openWithoutBase
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-extrabold uppercase text-slate-500">
            {es.registerConfirm.openingAmountLabel}
          </p>
          <p className="mt-1 text-3xl font-black tabular-nums text-slate-900">
            ${amount.toFixed(2)}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="flex-1 rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
            onClick={onCancel}
          >
            {es.registerConfirm.openModalCancel}
          </button>
          <button
            type="button"
            className="btn-pos-primary flex-1 rounded-xl px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-white"
            onClick={onConfirm}
          >
            {es.registerConfirm.openModalConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

