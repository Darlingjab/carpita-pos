import Link from "next/link";
import { KitchenDisplayClient } from "@/lib/components/KitchenDisplayClient";
import { ExportCsvPeriodLinks } from "@/lib/components/ExportCsvPeriodLinks";
import { Tv2 } from "lucide-react";

export default function CocinaPage() {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Cocina (KDS)</h1>
          <p className="text-sm text-slate-500">
            Los pedidos llegan al enviar «Enviar a cocina» desde Restaurante. Actualización automática cada 4 s.
          </p>
          <div className="mt-2">
            <ExportCsvPeriodLinks hrefBase="/api/kitchen/tickets/export" label="Exportar cocina CSV" />
          </div>
        </div>
        <Link
          href="/cocina/pantalla"
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white shadow hover:bg-slate-700 transition"
        >
          <Tv2 className="h-4 w-4" />
          Pantalla cocina
        </Link>
      </div>
      <KitchenDisplayClient />
    </section>
  );
}
