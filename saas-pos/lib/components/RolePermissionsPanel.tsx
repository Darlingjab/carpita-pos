"use client";

import { rolePermissions } from "@/lib/mock-data";
import { formatRole } from "@/lib/locale";
import type { Permission, RoleName } from "@/lib/types";
import { Check, X } from "lucide-react";

const ALL_ROLES: RoleName[] = ["admin", "supervisor", "cashier", "waiter", "cook"];

const ALL_PERMISSIONS: Permission[] = [
  "sales.create",
  "sales.refund",
  "register.open",
  "register.close",
  "register.movements",
  "reports.read",
  "products.manage",
  "users.manage",
  "kitchen.access",
  "favorites.manage",
];

const PERM_LABELS: Record<Permission, string> = {
  "sales.create": "Crear ventas y cobrar",
  "sales.refund": "Devoluciones y anulaciones",
  "register.open": "Abrir caja",
  "register.close": "Cerrar caja",
  "register.movements": "Gastos y movimientos de caja",
  "reports.read": "Ver informes y exportar datos",
  "products.manage": "Gestionar productos e inventario",
  "users.manage": "Gestionar usuarios y equipo",
  "kitchen.access": "Pantalla cocina (KDS)",
  "favorites.manage": "Favoritos y colores (Restaurante)",
};

const PERM_DESCRIPTIONS: Record<Permission, string> = {
  "sales.create": "Puede registrar ventas, cobrar pedidos y usar el punto de venta.",
  "sales.refund": "Puede anular ventas ya cobradas y procesar devoluciones.",
  "register.open": "Puede abrir un turno de caja con fondo inicial.",
  "register.close": "Puede cerrar caja y ver el arqueo de cierre.",
  "register.movements": "Puede registrar gastos, retiros y otros movimientos de caja.",
  "reports.read": "Puede ver reportes financieros y descargar exportaciones CSV.",
  "products.manage": "Puede crear, editar y eliminar productos del catálogo y gestionar insumos.",
  "users.manage": "Puede crear, editar y desactivar cuentas de usuario del equipo.",
  "kitchen.access": "Puede ver y operar la pantalla de cocina (KDS) para marcar pedidos.",
  "favorites.manage": "Puede personalizar favoritos y colores de mesas en el salón.",
};

/** Secciones del POS accesibles por cada rol. */
const ROLE_SECTIONS: Record<RoleName, string> = {
  admin: "Todas las secciones",
  supervisor: "Todas las secciones",
  cashier: "Inicio, Restaurante, Caja (Ventas/Gastos/Reportes), POS, Cocina, Clientes",
  waiter: "Restaurante, POS, Cocina",
  cook: "Cocina (KDS)",
};

export function RolePermissionsPanel() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-base font-black text-slate-900">Permisos por rol</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Matriz de permisos predeterminados. Puedes desactivar permisos individuales por usuario en la pestaña Equipo.
        </p>
      </div>

      {/* Tabla de permisos */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                Permiso
              </th>
              {ALL_ROLES.map((role) => (
                <th
                  key={role}
                  className="px-2.5 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  {formatRole(role)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ALL_PERMISSIONS.map((perm) => (
              <tr key={perm} className="hover:bg-slate-50/60">
                <td className="px-3 py-2.5">
                  <p className="text-sm font-semibold text-slate-800">{PERM_LABELS[perm]}</p>
                  <p className="mt-0.5 text-[0.68rem] leading-snug text-slate-500">
                    {PERM_DESCRIPTIONS[perm]}
                  </p>
                </td>
                {ALL_ROLES.map((role) => {
                  const has = (rolePermissions[role] as string[]).includes(perm);
                  return (
                    <td key={role} className="px-2.5 py-2.5 text-center">
                      {has ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" strokeWidth={3} />
                      ) : (
                        <X className="mx-auto h-4 w-4 text-slate-300" strokeWidth={2} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Secciones accesibles por rol */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">
          Secciones del POS por rol
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Pantallas visibles en la barra de navegación según el rol del usuario.
        </p>
        <div className="mt-4 space-y-3">
          {ALL_ROLES.map((role) => (
            <div key={role} className="flex items-start gap-3">
              <span className="inline-flex min-w-[90px] shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                {formatRole(role)}
              </span>
              <span className="text-sm text-slate-600">{ROLE_SECTIONS[role]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-xs font-medium text-blue-800">
          💡 <strong>Tip:</strong> Para personalizar permisos de un usuario específico, ve a la pestaña Equipo y edita su perfil. Ahí puedes desactivar permisos individuales sin cambiar su rol.
        </p>
      </div>
    </div>
  );
}
