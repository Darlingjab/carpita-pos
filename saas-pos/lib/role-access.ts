import type { RoleName } from "@/lib/types";

const CASHIER_ALLOWED_PREFIXES = ["/mesas", "/ventas", "/register", "/pos", "/cocina"];
const WAITER_ALLOWED_PREFIXES = ["/mesas", "/pos", "/cocina"];

/**
 * Rutas permitidas por rol. `enabled === false` bloquea todo el dashboard salvo que el layout redirija.
 */
export function canAccessPath(
  role: RoleName,
  pathname: string,
  options?: { enabled?: boolean },
): boolean {
  if (options?.enabled === false) return false;
  if (role === "admin" || role === "supervisor") return true;
  if (role === "cook") {
    return pathname === "/cocina" || pathname.startsWith("/cocina/");
  }
  if (role === "waiter") {
    return WAITER_ALLOWED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  }
  return CASHIER_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Tras iniciar sesión o al pulsar el logo: cocina solo ve KDS; el resto entra por restaurante. */
export function defaultDashboardPath(role: RoleName): string {
  if (role === "cook") return "/cocina";
  return "/mesas";
}

