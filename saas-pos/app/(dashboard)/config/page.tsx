import { Suspense } from "react";
import { ConfigPageClient } from "@/lib/components/ConfigPageClient";
import { SectionSubNav, SUB_NAV_GROUPS } from "@/lib/components/SectionSubNav";

export default function ConfigPage() {
  return (
    <>
      <SectionSubNav items={SUB_NAV_GROUPS.admin} />
      <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Cargando…</div>}>
        <ConfigPageClient />
      </Suspense>
    </>
  );
}
