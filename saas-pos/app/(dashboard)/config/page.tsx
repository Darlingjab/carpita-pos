import { Suspense } from "react";
import { ConfigPageClient } from "@/lib/components/ConfigPageClient";

export default function ConfigPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Cargando…</div>}>
      <ConfigPageClient />
    </Suspense>
  );
}
