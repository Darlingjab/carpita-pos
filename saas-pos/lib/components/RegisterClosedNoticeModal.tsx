"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { es } from "@/lib/locale";

export function RegisterClosedNoticeModal() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [registerOpen, setRegisterOpen] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const isArqueosScreen = useMemo(
    () => pathname === "/ventas" && searchParams.get("tab") === "arqueos",
    [pathname, searchParams],
  );

  /** Solo en Restaurante (mesas); en el resto de secciones no molesta. */
  const isRestaurantTab = pathname === "/mesas";

  useEffect(() => {
    const refresh = () => {
      fetch("/api/register/status")
        .then((r) => r.json())
        .then((d) => {
          const open = !!d.data?.isOpen;
          setRegisterOpen(open);
          if (open) setDismissed(false);
        })
        .catch(() => setRegisterOpen(false));
    };
    refresh();
    window.addEventListener("pos-register-updated", refresh);
    return () => window.removeEventListener("pos-register-updated", refresh);
  }, []);

  if (registerOpen !== false || dismissed || isArqueosScreen || !isRestaurantTab) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-amber-300 bg-white/98 p-5 shadow-2xl">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-black text-slate-900">
              {es.orderFlow.registerClosedModalTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{es.orderFlow.registerClosedModalLead}</p>
            <p className="mt-1 text-xs text-slate-500">
              Aviso: puedes seguir navegando, pero no cobrar ni registrar gastos hasta abrir caja.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
            onClick={() => setDismissed(true)}
          >
            Cerrar aviso
          </button>
          <Link
            href="/ventas?tab=arqueos"
            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-extrabold uppercase text-white hover:bg-amber-600"
          >
            {es.orderFlow.registerClosedModalGo}
          </Link>
        </div>
      </div>
    </div>
  );
}
