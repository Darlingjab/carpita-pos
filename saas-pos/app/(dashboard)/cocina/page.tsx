import Link from "next/link";
import { KitchenDisplayClient } from "@/lib/components/KitchenDisplayClient";
import { ErrorBoundary } from "@/lib/components/ErrorBoundary";
import { Tv2 } from "lucide-react";

export default function CocinaPage() {
  return (
    <ErrorBoundary section="Cocina">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Cocina · KDS</h1>
            <p className="mt-1 text-sm text-slate-500">
              Los pedidos llegan automáticamente al enviar desde Restaurante. Se actualiza cada 4 s.
            </p>
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
    </ErrorBoundary>
  );
}
