"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Indicador de estado de caja en el header.
 * Verde = abierta, rojo = cerrada. Click lleva a Arqueos de caja.
 */
export function RegisterStatusChip() {
  const [status, setStatus] = useState<"open" | "closed" | null>(null);

  useEffect(() => {
    const refresh = () => {
      fetch("/api/register/status")
        .then((r) => r.json())
        .then((d) => setStatus(!!d.data?.isOpen ? "open" : "closed"))
        .catch(() => setStatus("closed"));
    };
    refresh();
    const id = setInterval(refresh, 15_000);
    window.addEventListener("pos-register-updated", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("pos-register-updated", refresh);
    };
  }, []);

  if (status === null) return null;

  return (
    <Link
      href="/ventas?tab=arqueos"
      title={status === "open" ? "Caja abierta — ir a arqueos" : "Caja cerrada — ir a arqueos"}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-wide transition-opacity hover:opacity-75 ${
        status === "open"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-600"
      }`}
    >
      {/* Dot: pulsante si está abierta, estático si está cerrada */}
      <span className="relative flex h-2 w-2 shrink-0">
        {status === "open" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            status === "open" ? "bg-emerald-500" : "bg-rose-400"
          }`}
        />
      </span>
      <span className="hidden sm:inline">{status === "open" ? "Caja abierta" : "Caja cerrada"}</span>
      <span className="sm:hidden">{status === "open" ? "Abierta" : "Cerrada"}</span>
    </Link>
  );
}
