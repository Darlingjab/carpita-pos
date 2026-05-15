"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SubNavItem = { href: string; label: string };

type Props = {
  items: readonly SubNavItem[];
  ariaLabel?: string;
};

/**
 * Sub-navegación dentro de un grupo (ej: Caja → Ventas/Gastos/Reportes).
 * Renderiza pestañas horizontales debajo del header principal.
 */
export function SectionSubNav({ items, ariaLabel = "Sub-secciones" }: Props) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={ariaLabel}
      className="-mx-3 mb-3 flex shrink-0 gap-1 overflow-x-auto border-b px-3 sm:-mx-4 sm:px-4"
      style={{ borderColor: "var(--pos-border)" }}
    >
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`relative shrink-0 whitespace-nowrap px-3 py-2.5 text-[0.7rem] font-extrabold uppercase tracking-wide transition-colors ${
              active
                ? "text-[var(--pos-primary)]"
                : "text-slate-500 hover:text-slate-800"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {it.label}
            {active && (
              <span
                className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-t"
                style={{ backgroundColor: "var(--pos-primary)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Items predefinidos para cada grupo. */
export const SUB_NAV_GROUPS = {
  caja: [
    { href: "/ventas", label: "Ventas" },
    { href: "/gastos", label: "Gastos" },
    { href: "/finanzas", label: "Reportes" },
  ],
  inventario: [
    { href: "/products", label: "Catálogo" },
    { href: "/inventario", label: "Insumos" },
  ],
  admin: [
    { href: "/config", label: "Configuración" },
    { href: "/auditoria", label: "Auditoría" },
  ],
} as const;
