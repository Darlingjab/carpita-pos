import type { LucideIcon } from "lucide-react";
import {
  ChefHat,
  Home,
  LayoutGrid,
  Package,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

export type NavGroup = "inicio" | "restaurante" | "cocina" | "caja" | "inventario" | "clientes" | "admin";

export const dashboardRoutes: {
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Sub-rutas que pertenecen al mismo grupo (para activar el tab cuando el usuario está en cualquiera de ellas) */
  groupPaths: string[];
}[] = [
  { href: "/inicio",   label: "Inicio",      icon: Home,       group: "inicio",      groupPaths: ["/inicio"] },
  { href: "/mesas",    label: "Restaurante", icon: LayoutGrid, group: "restaurante", groupPaths: ["/mesas"] },
  { href: "/cocina",   label: "Cocina",      icon: ChefHat,    group: "cocina",      groupPaths: ["/cocina"] },
  { href: "/ventas",   label: "Caja",        icon: Wallet,     group: "caja",        groupPaths: ["/ventas", "/gastos", "/finanzas"] },
  { href: "/products", label: "Inventario",  icon: Package,    group: "inventario",  groupPaths: ["/products", "/inventario"] },
  { href: "/clientes", label: "Clientes",    icon: Users,      group: "clientes",    groupPaths: ["/clientes"] },
  { href: "/config",   label: "Admin",       icon: Settings,   group: "admin",       groupPaths: ["/config", "/auditoria"] },
];

export function isNavActive(pathname: string, href: string): boolean {
  const route = dashboardRoutes.find((r) => r.href === href);
  if (!route) return pathname === href;
  return route.groupPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
