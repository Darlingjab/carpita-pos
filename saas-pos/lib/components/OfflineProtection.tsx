"use client";

import { useEffect, useState } from "react";
import { CloudUpload, WifiOff } from "lucide-react";
import { pendingOfflineSaleCount } from "@/lib/offline-sale-queue";
import { es } from "@/lib/locale";

export function OfflineProtection() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    setPending(pendingOfflineSaleCount());
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onQueue = () => setPending(pendingOfflineSaleCount());
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("pos-offline-queue-changed", onQueue);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pos-offline-queue-changed", onQueue);
    };
  }, []);

  useEffect(() => {
    if (online && pending === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [online, pending]);

  const showOffline = !online;
  const showPending = pending > 0;

  if (!showOffline && !showPending) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[140] flex flex-col items-center gap-2 px-3">
      {showOffline && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 shadow-lg">
          <WifiOff className="h-4 w-4 shrink-0" />
          {es.offline.offlineBanner}
        </div>
      )}
      {showPending && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-950 shadow-lg">
          <CloudUpload className="h-4 w-4 shrink-0" />
          {es.offline.pendingBanner.replace("{n}", String(pending))}
        </div>
      )}
    </div>
  );
}
