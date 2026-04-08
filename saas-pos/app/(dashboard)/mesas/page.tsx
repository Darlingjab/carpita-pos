import { Suspense } from "react";
import { getCurrentUserMock } from "@/lib/auth";
import { demoTables } from "@/lib/mock-data";
import { RestaurantPageClient } from "@/lib/components/RestaurantPageClient";
import { es } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function MesasPage() {
  const user = await getCurrentUserMock();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          {es.pos.loading}
        </div>
      }
    >
      <RestaurantPageClient
        tables={demoTables}
        currentUser={{
          id: user.id,
          fullName: user.fullName,
          role: user.role,
        }}
      />
    </Suspense>
  );
}
