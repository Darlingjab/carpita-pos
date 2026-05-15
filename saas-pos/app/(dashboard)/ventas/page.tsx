import { Suspense } from "react";
import { VentasHubView } from "@/lib/components/VentasHubView";
import { ErrorBoundary } from "@/lib/components/ErrorBoundary";

export default function VentasPage() {
  return (
    <ErrorBoundary section="Ventas">
      <Suspense
        fallback={<div className="p-8 text-center text-slate-500">Cargando ventas…</div>}
      >
        <VentasHubView />
      </Suspense>
    </ErrorBoundary>
  );
}
