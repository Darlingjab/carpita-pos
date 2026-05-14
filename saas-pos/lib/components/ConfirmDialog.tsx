"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Modal de confirmación accesible que reemplaza window.confirm().
 * Cierra con Escape, tiene role="alertdialog", y soporta acción destructiva.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/45 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        {title && (
          <h3 id="confirm-dialog-title" className="text-sm font-black text-slate-900">
            {title}
          </h3>
        )}
        <p
          id="confirm-dialog-desc"
          className={`text-sm text-slate-600 ${title ? "mt-1.5" : ""}`}
        >
          {message}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-2.5 text-sm font-extrabold text-white ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "btn-pos-primary"
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
