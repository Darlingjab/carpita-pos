import { getRegisterSessionSnapshot, setRegisterSessionSnapshot } from "@/lib/register-session-store";
import { createServiceSupabase, isCloudPersistenceEnabled } from "@/lib/supabase/service";
import {
  getStoreSnapshot,
  replaceStoreSnapshot,
  type StoreSnapshot,
} from "@/lib/store";
import type { Customer, KitchenTicket, RegisterMovement, Sale } from "@/lib/types";
import type { CustomerPointsMovement } from "@/lib/types";
import type { UserAccountRow } from "@/lib/types";
import { getAllUserRows, replaceAllUserRows } from "@/lib/user-accounts";

type DbRow = {
  sales: unknown;
  register_movements: unknown;
  kitchen_tickets: unknown;
  customers: unknown;
  customer_points_movements: unknown;
  user_accounts: unknown;
  register_open: boolean;
  register_opening_float: number | string;
};

function asSaleArray(v: unknown): Sale[] {
  return Array.isArray(v) ? (v as Sale[]) : [];
}

function asRegisterMovementArray(v: unknown): RegisterMovement[] {
  return Array.isArray(v) ? (v as RegisterMovement[]) : [];
}

function asKitchenArray(v: unknown): KitchenTicket[] {
  return Array.isArray(v) ? (v as KitchenTicket[]) : [];
}

function asCustomerArray(v: unknown): Customer[] {
  return Array.isArray(v) ? (v as Customer[]) : [];
}

function asPointsArray(v: unknown): CustomerPointsMovement[] {
  return Array.isArray(v) ? (v as CustomerPointsMovement[]) : [];
}

function asUserRows(v: unknown): UserAccountRow[] {
  return Array.isArray(v) ? (v as UserAccountRow[]) : [];
}

function isDbUnseeded(row: DbRow): boolean {
  return asUserRows(row.user_accounts).length === 0;
}

/**
 * Lee el estado desde Supabase y lo aplica en memoria.
 * Si la tabla está vacía (sin usuarios), sube el estado inicial del código a la nube.
 */
export async function pullRuntimeFromCloud(): Promise<void> {
  if (!isCloudPersistenceEnabled()) return;
  const supabase = createServiceSupabase();
  if (!supabase) return;

  let data: DbRow | null = null;
  try {
    const res = await supabase
      .from("pos_runtime_state")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (res.error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[cloud-sync] pull:", res.error.message);
      }
      return;
    }
    data = res.data as DbRow | null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (process.env.NODE_ENV === "development") {
      console.warn("[cloud-sync] pull (network):", msg);
    }
    return;
  }
  if (!data) return;

  const row = data as DbRow;
  if (isDbUnseeded(row)) {
    const seeded = await pushRuntimeToCloud();
    if (!seeded.ok) {
      console.error("[cloud-sync] seed push:", seeded.error);
    }
    return;
  }

  const rawSales = asSaleArray(row.sales);
  const mod = await import("@/lib/data/imported-sales-sample");
  const importedIds = new Set(mod.importedSalesSeed.map((s) => s.id));
  /** En memoria solo deltas de sesión; el CSV no se persiste en Supabase. */
  const sales = rawSales.filter((s) => !importedIds.has(s.id));

  const snap: StoreSnapshot = {
    sales,
    registerMovements: asRegisterMovementArray(row.register_movements),
    kitchenTickets: asKitchenArray(row.kitchen_tickets),
    customers: asCustomerArray(row.customers),
    customerPointsMovements: asPointsArray(row.customer_points_movements),
  };
  replaceStoreSnapshot(snap);
  replaceAllUserRows(asUserRows(row.user_accounts));
  setRegisterSessionSnapshot(
    Boolean(row.register_open),
    Math.max(0, Number(row.register_opening_float) || 0),
  );
}

/** Guarda el estado en memoria en Supabase (llamar tras mutaciones). */
export async function pushRuntimeToCloud(): Promise<{ ok: boolean; error?: string }> {
  if (!isCloudPersistenceEnabled()) return { ok: true };
  const supabase = createServiceSupabase();
  if (!supabase) return { ok: false, error: "missing_service_client" };

  const storeSnap = getStoreSnapshot();
  const usersSnap = getAllUserRows();
  const reg = getRegisterSessionSnapshot();

  const { error } = await supabase.from("pos_runtime_state").upsert(
    {
      id: "default",
      sales: storeSnap.sales,
      register_movements: storeSnap.registerMovements,
      kitchen_tickets: storeSnap.kitchenTickets,
      customers: storeSnap.customers,
      customer_points_movements: storeSnap.customerPointsMovements,
      user_accounts: usersSnap,
      register_open: reg.isOpen,
      register_opening_float: reg.openingFloat,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("[cloud-sync] push:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
