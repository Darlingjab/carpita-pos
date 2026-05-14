import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  LayoutGrid,
  Package,
  Receipt,
  Settings,
  Shield,
  Users,
  UserCog,
} from "lucide-react";

export const dashboardRoutes: {
  href: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { href: "/mesas",     label: "Restaurante", icon: LayoutGrid   },
  { href: "/ventas",    label: "Ventas",       icon: BarChart3    },
  { href: "/gastos",    label: "Gastos",       icon: Receipt      },
  { href: "/finanzas",  label: "Finanzas",     icon: ClipboardList },
  { href: "/products",  label: "Inventario",   icon: Package      },
  { href: "/clientes",  label: "Clientes",     icon: Users        },
  { href: "/cocina",    label: "Cocina",       icon: ChefHat      },
  { href: "/config",    label: "Equipo",       icon: UserCog      },
  { href: "/auditoria", label: "Auditoría",    icon: Shield       },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/mesas") return false;
  return pathname.startsWith(`${href}/`);
}
