import { KitchenDisplayClient } from "@/lib/components/KitchenDisplayClient";
import { ExportCsvPeriodLinks } from "@/lib/components/ExportCsvPeriodLinks";

export default function CocinaPage() {
  return (
    <section className="space-y-2">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Cocina (KDS)</h1>
        <p className="text-sm text-slate-500">
          Los pedidos llegan al enviar «Enviar a cocina» desde Restaurante. Actualización cada pocos segundos.
        </p>
        <div className="mt-2">
          <ExportCsvPeriodLinks hrefBase="/api/kitchen/tickets/export" label="Exportar cocina CSV" />
        </div>
      </div>
      <KitchenDisplayClient />
    </section>
  );
}
