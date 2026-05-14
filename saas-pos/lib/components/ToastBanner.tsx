"use client";

import { useEffect } from "react";

type Props = {
  message: string | null;
  onDismiss: () => void;
  /** ms antes de auto-dismiss. Default: 3500 */
  duration?: number;
};

/**
 * Banner de toast no bloqueante que reemplaza window.alert().
 * Se muestra en la parte inferior de la pantalla y se cierra solo.
 */
export function ToastBanner({ message, onDismiss, duration = 3500 }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [message, onDismiss, duration]);

  if (!message) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[300] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <span className="flex-1 leading-snug">{message}</span>
        <button
          type="button"
          className="shrink-0 text-slate-400 hover:text-white"
          onClick={onDismiss}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
