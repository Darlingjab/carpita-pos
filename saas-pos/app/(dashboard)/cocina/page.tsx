import { KitchenDisplayClient } from "@/lib/components/KitchenDisplayClient";

export default function CocinaPage() {
  return (
    <section className="space-y-2">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Cocina (KDS)</h1>
        <p className="text-sm text-slate-500">
          Los pedidos llegan al enviar «Enviar a cocina» desde Restaurante. Actualización cada pocos segundos.
        </p>
        <div className="mt-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
            onClick={() => window.open("/api/kitchen/tickets/export", "_blank")}
          >
            Exportar cocina CSV
          </button>
        </div>
      </div>
      <KitchenDisplayClient />
    </section>
  );
}
