"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineProtection() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (online) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [online]);

  if (online) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[140] flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 shadow-lg">
        <WifiOff className="h-4 w-4" />
        Sin conexion. Mantendremos tus datos locales y evitaremos cerrar la pagina por error.
      </div>
    </div>
  );
}
