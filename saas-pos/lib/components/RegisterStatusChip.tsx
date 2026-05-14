"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleDot } from "lucide-react";

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
      className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide transition hover:opacity-80 ${
        status === "open"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      <CircleDot className="h-2.5 w-2.5 shrink-0" aria-hidden />
      <span className="hidden sm:inline">{status === "open" ? "Caja abierta" : "Caja cerrada"}</span>
      <span className="sm:hidden">{status === "open" ? "Abierta" : "Cerrada"}</span>
    </Link>
  );
}
