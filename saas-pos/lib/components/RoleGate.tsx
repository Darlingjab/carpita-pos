"use client";

import { usePathname } from "next/navigation";
import type { RoleName } from "@/lib/types";
import { canAccessPath } from "@/lib/role-access";

function deniedMessage(role: RoleName): string {
  switch (role) {
    case "waiter":
      return "Tu perfil de mesero incluye Restaurante, Punto de venta y Cocina (KDS). No incluye Ventas, Caja ni administración.";
    case "cook":
      return "Tu perfil de cocina solo incluye la pantalla Cocina (KDS).";
    case "cashier":
      return "Tu perfil de cajero incluye Restaurante, Ventas, Caja, Punto de venta y Cocina (KDS). El resto de secciones las gestiona un supervisor o administrador.";
    default:
      return "No tienes permiso para ver esta sección.";
  }
}

export function RoleGate({
  role,
  enabled = true,
  children,
}: {
  role: RoleName;
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (!canAccessPath(role, pathname, { enabled })) {
    return (
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
        <h2 className="text-lg font-black text-slate-800">Sin acceso a esta sección</h2>
        <p className="mt-2 text-sm text-slate-600">{deniedMessage(role)}</p>
      </section>
    );
  }
  return <>{children}</>;
}
