import { Suspense } from "react";
import { VentasHubView } from "@/lib/components/VentasHubView";
import { ErrorBoundary } from "@/lib/components/ErrorBoundary";
import { SectionSubNav, SUB_NAV_GROUPS } from "@/lib/components/SectionSubNav";

export default function VentasPage() {
  return (
    <ErrorBoundary section="Ventas">
      <SectionSubNav items={SUB_NAV_GROUPS.caja} />
      <Suspense
        fallback={<div className="p-8 text-center text-slate-500">Cargando ventas…</div>}
      >
        <VentasHubView />
      </Suspense>
    </ErrorBoundary>
  );
}
