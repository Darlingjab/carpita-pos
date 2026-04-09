import { demoBusinessId, rolePermissions } from "@/lib/mock-data";
import type { AppUser, Permission, RoleName, UserAccountRow } from "@/lib/types";
import { uniqueStaffEmail } from "@/lib/staff-email";

const rows: UserAccountRow[] = [
  {
    id: "usr_admin",
    businessId: demoBusinessId,
    fullName: "Administrador Carpita",
    email: "admin@carpita",
    role: "admin",
    passwordPlain: "1234",
    enabled: true,
    disabledPermissions: [],
  },
  {
    id: "usr_cashier",
    businessId: demoBusinessId,
    fullName: "Cajero Carpita",
    email: "cajero@carpita",
    role: "cashier",
    passwordPlain: "1234",
    enabled: true,
    disabledPermissions: [],
  },
  {
    id: "usr_supervisor",
    businessId: demoBusinessId,
    fullName: "Sam Supervisor",
    email: "supervisor@demo.local",
    role: "supervisor",
    passwordPlain: "1234",
    enabled: true,
    disabledPermissions: [],
  },
];

export function toAppUser(r: UserAccountRow): AppUser {
  return {
    id: r.id,
    businessId: r.businessId,
    fullName: r.fullName,
    email: r.email,
    role: r.role,
    enabled: r.enabled,
  };
}

export function getDefaultAppUser(): AppUser {
  const admin = rows.find((r) => r.role === "admin" && r.enabled) ?? rows[0];
  return toAppUser(admin);
}

export function getAllUserRows(): UserAccountRow[] {
  return [...rows];
}

/** Reemplaza todas las cuentas (hidratación desde Supabase). */
export function replaceAllUserRows(next: UserAccountRow[]) {
  rows.length = 0;
  rows.push(...next);
}

export function findRowById(id: string): UserAccountRow | null {
  return rows.find((r) => r.id === id) ?? null;
}

export function findRowByEmail(email: string): UserAccountRow | null {
  const e = email.trim().toLowerCase();
  return rows.find((r) => r.email.toLowerCase() === e) ?? null;
}

export function verifyLogin(email: string, password: string): AppUser | null {
  const r = findRowByEmail(email);
  if (!r || !r.enabled) return null;
  if (r.passwordPlain !== password) return null;
  return toAppUser(r);
}

export function emailTaken(email: string, excludeId?: string): boolean {
  const e = email.trim().toLowerCase();
  return rows.some((r) => r.email.toLowerCase() === e && r.id !== excludeId);
}

function countEnabledAdmins(): number {
  return rows.filter((r) => r.role === "admin" && r.enabled).length;
}

export function createUserAccount(input: {
  fullName: string;
  email: string;
  passwordPlain: string;
  role: RoleName;
  enabled?: boolean;
  disabledPermissions?: Permission[];
}): UserAccountRow | null {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.fullName.trim()) return null;
  if (emailTaken(email)) return null;
  const row: UserAccountRow = {
    id: `usr_${Date.now()}`,
    businessId: demoBusinessId,
    fullName: input.fullName.trim(),
    email,
    role: input.role,
    passwordPlain: input.passwordPlain,
    enabled: input.enabled !== false,
    disabledPermissions: [...(input.disabledPermissions ?? [])],
  };
  rows.unshift(row);
  return row;
}

export function updateUserAccount(
  id: string,
  patch: Partial<{
    fullName: string;
    email: string;
    passwordPlain: string;
    role: RoleName;
    enabled: boolean;
    disabledPermissions: Permission[];
  }>,
): UserAccountRow | null {
  const r = findRowById(id);
  if (!r) return null;

  if (patch.email !== undefined) {
    const ne = patch.email.trim().toLowerCase();
    if (ne && emailTaken(ne, id)) return null;
    if (ne) r.email = ne;
  }
  if (patch.fullName !== undefined) r.fullName = patch.fullName.trim();
  if (patch.passwordPlain !== undefined) r.passwordPlain = patch.passwordPlain;
  if (patch.role !== undefined) {
    const nextRole = patch.role;
    if (r.role === "admin" && nextRole !== "admin" && countEnabledAdmins() <= 1 && r.enabled) {
      return null;
    }
    r.role = nextRole;
    r.disabledPermissions = r.disabledPermissions.filter((p) => rolePermissions[r.role].includes(p));
  }
  if (patch.enabled !== undefined) {
    if (r.role === "admin" && r.enabled && !patch.enabled && countEnabledAdmins() <= 1) {
      return null;
    }
    r.enabled = patch.enabled;
  }
  if (patch.disabledPermissions !== undefined) {
    r.disabledPermissions = [...patch.disabledPermissions];
  }
  return r;
}

export function deleteUserAccount(id: string): boolean {
  const r = findRowById(id);
  if (!r) return false;
  if (r.role === "admin" && countEnabledAdmins() <= 1 && r.enabled) {
    return false;
  }
  const i = rows.findIndex((x) => x.id === id);
  if (i === -1) return false;
  rows.splice(i, 1);
  return true;
}

export function changeOwnPassword(userId: string, currentPassword: string, newPassword: string): boolean {
  const r = findRowById(userId);
  if (!r || !r.enabled) return false;
  if (r.passwordPlain !== currentPassword) return false;
  if (!newPassword || newPassword.length < 4) return false;
  r.passwordPlain = newPassword;
  return true;
}

/** Sugerencia de correo único a partir del nombre completo */
export function suggestNewUserEmail(fullName: string): string {
  return uniqueStaffEmail(fullName, emailTaken);
}

export function permissionsForRole(role: RoleName): Permission[] {
  return rolePermissions[role] as Permission[];
}

export function userHasPermissionRow(r: UserAccountRow, permission: Permission): boolean {
  if (!r.enabled) return false;
  if (r.disabledPermissions.includes(permission)) return false;
  return rolePermissions[r.role].includes(permission);
}
