import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoBusiness, rolePermissions } from "@/lib/mock-data";
import { AppUser, Permission } from "@/lib/types";
import { canAccessPath } from "@/lib/role-access";
import { pullRuntimeFromCloud } from "@/lib/cloud-sync";
import { findRowByEmail, findRowById, getDefaultAppUser, toAppUser } from "@/lib/user-accounts";

/** @deprecated Las credenciales viven en cuentas de usuario (`user-accounts`). */
export const DEMO_CREDENTIALS = {} as Record<string, { password: string; role: string }>;

export async function getCurrentUserMock(): Promise<AppUser> {
  await pullRuntimeFromCloud();
  const store = await cookies();
  const email = store.get("pos_demo_user")?.value?.toLowerCase();
  if (!email) return getDefaultAppUser();
  const row = findRowByEmail(email);
  if (!row || !row.enabled) {
    redirect("/login");
  }
  return toAppUser(row);
}

export async function getSessionUserOrNull(): Promise<AppUser | null> {
  await pullRuntimeFromCloud();
  const store = await cookies();
  const email = store.get("pos_demo_user")?.value?.toLowerCase();
  if (!email) return null;
  const row = findRowByEmail(email);
  if (!row || !row.enabled) return null;
  return toAppUser(row);
}

export function getCurrentBusinessMock() {
  return demoBusiness;
}

export function hasPermission(user: AppUser, permission: Permission) {
  const row = findRowById(user.id);
  if (!row || !row.enabled) return false;
  if (row.disabledPermissions.includes(permission)) return false;
  return rolePermissions[user.role].includes(permission);
}

export function isAdminOnlyPath(pathname: string): boolean {
  return !canAccessPath("cashier", pathname);
}

