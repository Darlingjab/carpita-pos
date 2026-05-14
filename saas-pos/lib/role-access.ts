import type { RoleName } from "@/lib/types";

/** Cajero: puede operar caja, ventas, gastos y ver clientes. */
const CASHIER_ALLOWED_PREFIXES = [
  "/mesas",
  "/ventas",
  "/register",
  "/pos",
  "/cocina",
  "/gastos",
  "/clientes",
];

/** Mesero: toma pedidos en salón y ve cocina. */
const WAITER_ALLOWED_PREFIXES = ["/mesas", "/pos", "/cocina"];

/**
 * Rutas permitidas por rol. `enabled === false` bloquea todo el dashboard.
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
  // cashier
  return CASHIER_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Tras iniciar sesión o al pulsar el logo: cocina solo ve KDS; el resto entra por restaurante. */
export function defaultDashboardPath(role: RoleName): string {
  if (role === "cook") return "/cocina";
  return "/mesas";
}
