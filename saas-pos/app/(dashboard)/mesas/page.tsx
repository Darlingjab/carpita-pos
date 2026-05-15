import { Suspense } from "react";
import { getCurrentUserMock, hasPermission } from "@/lib/auth";
import { demoTables } from "@/lib/mock-data";
import { RestaurantPageClient } from "@/lib/components/RestaurantPageClient";
import { ErrorBoundary } from "@/lib/components/ErrorBoundary";
import { es } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function MesasPage() {
  const user = await getCurrentUserMock();

  return (
    <ErrorBoundary section="Restaurante">
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense
          fallback={
            <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
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
            canConfigureFavorites={hasPermission(user, "favorites.manage")}
          />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
