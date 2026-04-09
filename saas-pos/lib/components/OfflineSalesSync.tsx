"use client";

import { useCallback, useEffect, useRef } from "react";
import { flushOfflineSaleQueue } from "@/lib/offline-sale-queue";

/**
 * Reintenta enviar ventas guardadas en localStorage cuando hay red (montaje, evento online, intervalo).
 */
export function OfflineSalesSync() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = useCallback(() => {
    void flushOfflineSaleQueue();
  }, []);

  useEffect(() => {
    flush();
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);
    window.addEventListener("pos-force-sync-offline-sales", flush);
    intervalRef.current = setInterval(flush, 45_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pos-force-sync-offline-sales", flush);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [flush]);

  return null;
}
