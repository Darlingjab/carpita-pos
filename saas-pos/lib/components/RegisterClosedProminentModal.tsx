"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { es } from "@/lib/locale";

export function RegisterClosedProminentModal() {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="register-closed-modal-title"
      aria-describedby="register-closed-modal-desc"
    >
      <div className="w-full max-w-md rounded-2xl border-2 border-amber-400/80 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"
            aria-hidden
          >
            <AlertTriangle className="h-7 w-7" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h2
              id="register-closed-modal-title"
              className="text-lg font-black leading-tight text-slate-900 sm:text-xl"
            >
              {es.orderFlow.registerClosedModalTitle}
            </h2>
            <p
              id="register-closed-modal-desc"
              className="mt-2 text-sm leading-relaxed text-slate-600"
            >
              {es.orderFlow.registerClosedModalLead}
            </p>
          </div>
        </div>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm font-medium text-slate-800">
          <li>{es.orderFlow.registerClosedModalStep1}</li>
          <li>{es.orderFlow.registerClosedModalStep2}</li>
          <li>{es.orderFlow.registerClosedModalStep3}</li>
        </ol>
        <div className="mt-6 flex justify-center">
          <Link
            href="/ventas?tab=arqueos"
            className="btn-pos-primary inline-flex min-w-[240px] items-center justify-center rounded-xl px-5 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-white no-underline"
          >
            {es.orderFlow.registerClosedModalGo}
          </Link>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">{es.orderFlow.registerClosed}</p>
      </div>
    </div>
  );
}
