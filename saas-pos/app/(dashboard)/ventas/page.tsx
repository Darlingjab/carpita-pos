import { Suspense } from "react";
import { VentasHubView } from "@/lib/components/VentasHubView";

export default function VentasPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-center text-slate-500">Cargando ventas…</div>}
    >
      <VentasHubView />
    </Suspense>
  );
}
