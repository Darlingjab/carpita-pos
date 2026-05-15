import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoBusiness, rolePermissions } from "@/lib/mock-data";
import { AppUser, Permission } from "@/lib/types";
import { canAccessPath } from "@/lib/role-access";
import { pullRuntimeFromCloud } from "@/lib/cloud-sync";
import { findRowById, getDefaultAppUser, toAppUser } from "@/lib/user-accounts";
import { verifySession } from "@/lib/session";
import { COOKIE_NAME } from "@/lib/auth-cookie";
export { COOKIE_NAME } from "@/lib/auth-cookie";

/** @deprecated Las credenciales viven en cuentas de usuario (`user-accounts`). */
export const DEMO_CREDENTIALS = {} as Record<string, { password: string; role: string }>;

/** Lee y valida la cookie de sesión. Devuelve el userId o null. */
async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value ?? "";
  return verifySession(token);
}

export async function getCurrentUserMock(): Promise<AppUser> {
  await pullRuntimeFromCloud();
  const userId = await getSessionUserId();
  if (!userId) return getDefaultAppUser();
  const row = findRowById(userId);
  if (!row || !row.enabled) {
    redirect("/login");
  }
  return toAppUser(row);
}

export async function getSessionUserOrNull(): Promise<AppUser | null> {
  await pullRuntimeFromCloud();
  const userId = await getSessionUserId();
  if (!userId) return null;
  const row = findRowById(userId);
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
