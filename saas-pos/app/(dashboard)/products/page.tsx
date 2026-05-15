import { ProductsAdminView } from "@/lib/components/ProductsAdminView";
import { InventarioView } from "@/lib/components/InventarioView";
import { SectionSubNav, SUB_NAV_GROUPS } from "@/lib/components/SectionSubNav";

type Props = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  // Backwards compat: si llega ?tab=inventario, mostramos insumos en esta misma ruta.
  const tab = sp.tab === "inventario" ? "inventario" : "productos";

  return (
    <div className="animate-fade-in -mx-1 flex min-h-[calc(100dvh-5rem)] flex-1 flex-col gap-3 sm:-mx-2">
      <SectionSubNav items={SUB_NAV_GROUPS.inventario} />
      {tab === "productos" ? <ProductsAdminView /> : <InventarioView />}
    </div>
  );
}
