import Link from "next/link";
import { ProductsAdminView } from "@/lib/components/ProductsAdminView";
import { LegacySectionStub } from "@/lib/components/LegacySectionStub";

type Props = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const tab = sp.tab === "inventario" ? "inventario" : "productos";

  return (
    <div className="-mx-1 flex min-h-[calc(100dvh-5rem)] flex-1 flex-col sm:-mx-2">
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
        <Link
          href="/products?tab=productos"
          className={`rounded-lg px-3 py-1.5 text-xs font-extrabold uppercase ${
            tab === "productos"
              ? "bg-[var(--pos-primary)] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Productos
        </Link>
        <Link
          href="/products?tab=inventario"
          className={`rounded-lg px-3 py-1.5 text-xs font-extrabold uppercase ${
            tab === "inventario"
              ? "bg-[var(--pos-primary)] text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Inventario
        </Link>
      </div>

      {tab === "productos" ? (
        <ProductsAdminView />
      ) : (
        <LegacySectionStub
          title="Inventario"
          description="Insumos, recetas y mermas como en InventarioView. Pendiente: enlazar con Supabase y movimientos de stock."
          legacyFile="pages/InventarioView.jsx"
        >
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/80 p-8 text-center text-sm text-slate-500">
            Tabla de insumos y ajustes (próxima iteración).
          </div>
        </LegacySectionStub>
      )}
    </div>
  );
}
