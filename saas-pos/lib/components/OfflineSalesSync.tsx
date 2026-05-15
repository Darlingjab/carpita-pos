"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushOfflineSaleQueue, pendingOfflineSaleCount } from "@/lib/offline-sale-queue";

/**
 * Reintenta enviar ventas guardadas en localStorage cuando hay red (montaje, evento online, intervalo).
 * Además muestra un banner persistente con el número de ventas pendientes y un botón para reintentar.
 */
export function OfflineSalesSync() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const flush = useCallback(() => {
    void flushOfflineSaleQueue();
  }, []);

  const refreshCount = useCallback(() => {
    try {
      setPendingCount(pendingOfflineSaleCount());
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    flush();
    refreshCount();
    const onOnline = () => flush();
    const onQueueChanged = () => refreshCount();
    window.addEventListener("online", onOnline);
    window.addEventListener("pos-force-sync-offline-sales", flush);
    window.addEventListener("pos-offline-queue-changed", onQueueChanged);
    intervalRef.current = setInterval(flush, 45_000);
    pollRef.current = setInterval(refreshCount, 5_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pos-force-sync-offline-sales", flush);
      window.removeEventListener("pos-offline-queue-changed", onQueueChanged);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [flush, refreshCount]);

  if (pendingCount === 0) return null;

  return (
    <div
      className="fixed top-16 right-4 z-[150] rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 shadow-lg"
      role="status"
      aria-live="polite"
    >
      <p className="text-xs font-bold text-amber-900">
        {pendingCount === 1
          ? "1 venta pendiente"
          : `${pendingCount} ventas pendientes`}{" "}
        de sincronizar
      </p>
      <button
        type="button"
        className="mt-1 text-[0.65rem] font-bold uppercase text-amber-700 underline hover:text-amber-900"
        onClick={() => {
          flush();
          window.dispatchEvent(new CustomEvent("pos-force-sync-offline-sales"));
        }}
      >
        Reintentar ahora
      </button>
    </div>
  );
}
