import { InventarioView } from "@/lib/components/InventarioView";
import { SectionSubNav, SUB_NAV_GROUPS } from "@/lib/components/SectionSubNav";

export default function InventarioPage() {
  return (
    <div className="animate-fade-in -mx-1 flex min-h-[calc(100dvh-5rem)] flex-1 flex-col gap-3 sm:-mx-2">
      <SectionSubNav items={SUB_NAV_GROUPS.inventario} />
      <InventarioView />
    </div>
  );
}
