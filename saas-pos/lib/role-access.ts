import type { RoleName } from "@/lib/types";

/** Cajero: opera caja, ventas, gastos, reportes básicos y ve clientes. */
const CASHIER_ALLOWED_PREFIXES = [
  "/inicio",
  "/mesas",
  "/ventas",
  "/register",
  "/pos",
  "/cocina",
  "/gastos",
  "/finanzas",
  "/clientes",
];

/** Mesero: toma pedidos en salón y ve cocina. Sin acceso a dashboard ni caja. */
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

/** Tras iniciar sesión o al pulsar el logo: según el rol. */
export function defaultDashboardPath(role: RoleName): string {
  if (role === "cook") return "/cocina";
  if (role === "waiter") return "/mesas";
  return "/inicio";
}
