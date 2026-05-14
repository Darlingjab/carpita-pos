"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { rolePermissions } from "@/lib/mock-data";
import { formatRole } from "@/lib/locale";
import type { AppUser, Permission, RoleName } from "@/lib/types";
import { suggestStaffEmail } from "@/lib/staff-email";

const PERM_LABELS: Record<Permission, string> = {
  "sales.create": "Ventas y cobro",
  "sales.refund": "Devoluciones",
  "register.open": "Abrir caja",
  "register.close": "Cerrar caja",
  "register.movements": "Gastos y movimientos de caja",
  "reports.read": "Informes y exportaciones",
  "products.manage": "Productos e inventario",
  "users.manage": "Usuarios y equipo",
  "kitchen.access": "Pantalla cocina (KDS)",
  "favorites.manage": "Favoritos y colores (Restaurante)",
};

type UserDto = {
  id: string;
  businessId: string;
  fullName: string;
  email: string;
  role: RoleName;
  enabled?: boolean;
  disabledPermissions: Permission[];
};

export function EquipoTeamPanel() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [meta, setMeta] = useState<{ canManageUsers: boolean; staffEmailDomain: string } | null>(null);
  const [me, setMe] = useState<AppUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    fetch("/api/users")
      .then((r) => {
        if (r.status === 403) {
          setLoadError("No tienes permiso para ver el equipo.");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setLoadError(null);
        setUsers(d.data ?? []);
        setMeta(d.meta ?? { canManageUsers: false, staffEmailDomain: "local" });
      })
      .catch(() => setLoadError("No se pudo cargar el equipo."))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.data ?? null))
      .catch(() => setMe(null));
  }, []);

  const canManage = meta?.canManageUsers ?? false;
  const domain = meta?.staffEmailDomain ?? "local";

  const editUser = useMemo(() => users.find((u) => u.id === editId) ?? null, [users, editId]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-20 rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <p className="text-sm text-slate-500">
        {canManage
          ? `Usuarios que pueden entrar al POS. Correo sugerido: nombre@${domain}`
          : "Cambia tu contraseña desde el menú de perfil (arriba a la derecha)."}
      </p>

      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{loadError}</div>
      )}

      {canManage && (
        <button
          type="button"
          className="btn-pos-primary rounded-lg px-4 py-2 text-xs font-extrabold uppercase"
          onClick={() => setCreateOpen(true)}
        >
          Nuevo usuario
        </button>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Usuario (correo)</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Permisos</th>
              {canManage && <th className="px-3 py-2 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.enabled === false ? "bg-slate-50 text-slate-500" : ""}>
                <td className="px-3 py-2 font-semibold text-slate-900">{u.fullName}</td>
                <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                <td className="px-3 py-2">{formatRole(u.role)}</td>
                <td className="px-3 py-2">{u.enabled === false ? "Desactivado" : "Activo"}</td>
                <td className="max-w-[200px] px-3 py-2 text-xs text-slate-600">
                  {permSummary(u)}
                </td>
                {canManage && (
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-xs font-bold text-[var(--pos-primary)] underline"
                      onClick={() => setEditId(u.id)}
                    >
                      Editar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <UserFormModal
          key="create-user"
          title="Nuevo usuario"
          domainHint={domain}
          onClose={() => setCreateOpen(false)}
          onSave={async (payload) => {
            const res = await fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fullName: payload.fullName,
                email: payload.email,
                password: payload.password ?? "",
                role: payload.role,
                enabled: payload.enabled,
                disabledPermissions: payload.disabledPermissions,
              }),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) {
              window.alert(
                d.error === "password_short"
                  ? "La contraseña debe tener al menos 6 caracteres."
                  : d.error === "email_taken_or_invalid"
                    ? "Correo ya en uso u datos inválidos."
                    : "No se pudo crear el usuario.",
              );
              return;
            }
            setCreateOpen(false);
            load();
          }}
        />
      )}

      {editUser && canManage && (
        <UserFormModal
          key={editUser.id}
          title="Editar usuario"
          domainHint={domain}
          initial={editUser}
          onClose={() => setEditId(null)}
          onSave={async (payload) => {
            const body: Record<string, unknown> = {
              fullName: payload.fullName,
              email: payload.email,
              role: payload.role,
              enabled: payload.enabled,
              disabledPermissions: payload.disabledPermissions,
            };
            if (payload.password) body.password = payload.password;
            const res = await fetch(`/api/users/${editUser.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) {
              window.alert(
                d.error === "not_found_or_invalid"
                  ? "No se pudo guardar (¿último administrador?)."
                  : "Error al actualizar.",
              );
              return;
            }
            setEditId(null);
            load();
          }}
          onDelete={
            editUser.id !== me?.id &&
            (editUser.role !== "admin" ||
              users.filter((x) => x.role === "admin" && x.enabled !== false).length > 1)
              ? async () => {
                  if (!window.confirm("¿Eliminar este usuario? No podrá iniciar sesión.")) return;
                  const res = await fetch(`/api/users/${editUser.id}`, { method: "DELETE" });
                  const d = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    window.alert(
                      d.error === "cannot_delete_self"
                        ? "No puedes eliminarte a ti mismo."
                        : "No se pudo eliminar.",
                    );
                    return;
                  }
                  setEditId(null);
                  load();
                }
              : undefined
          }
        />
      )}

    </div>
  );
}

function permSummary(u: UserDto): string {
  const base = rolePermissions[u.role] as Permission[];
  const off = new Set(u.disabledPermissions ?? []);
  const active = base.filter((p) => !off.has(p));
  if (active.length === 0) return "Ninguno (revisar)";
  return active.map((p) => PERM_LABELS[p] ?? p).join(" · ");
}

type FormPayload = {
  fullName: string;
  email: string;
  password?: string;
  role: RoleName;
  enabled: boolean;
  disabledPermissions: Permission[];
};

function UserFormModal({
  title,
  domainHint,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  title: string;
  domainHint: string;
  initial?: UserDto | null;
  onClose: () => void;
  onSave: (p: FormPayload) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}) {
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => {
    setPortalReady(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [emailManual, setEmailManual] = useState(!!initial);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleName>(initial?.role ?? "cashier");
  const [enabled, setEnabled] = useState(initial?.enabled !== false);
  const [disabled, setDisabled] = useState<Set<Permission>>(
    () => new Set(initial?.disabledPermissions ?? []),
  );

  const rolePerms = useMemo(() => (rolePermissions[role] as Permission[]) ?? [], [role]);

  function syncEmailFromName() {
    if (emailManual || !fullName.trim()) return;
    setEmail(suggestStaffEmail(fullName));
  }

  function togglePerm(p: Permission) {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function submit() {
    if (!initial) {
      if (!fullName.trim() || !email.trim()) {
        window.alert("Completa nombre y correo.");
        return;
      }
      if (password.length < 6) {
        window.alert("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
    }
    const payload: FormPayload = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      role,
      enabled,
      disabledPermissions: [...disabled],
    };
    if (password.length > 0) payload.password = password;
    await onSave(payload);
  }

  if (!portalReady) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/45"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex min-h-[100dvh] items-start justify-center p-3 py-10 sm:items-center sm:py-12">
        <div
          className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
          style={{
            borderColor: "var(--pos-border)",
            maxHeight: "min(90dvh, calc(100dvh - 2.5rem))",
            overflowY: "auto",
            touchAction: "auto",
            overscrollBehavior: "contain",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-form-modal-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
        <h3 id="user-form-modal-title" className="text-base font-black text-slate-900">
          {title}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Sugerencia de usuario: primer nombre + @{domainHint}
        </p>

        <label className="mt-4 block text-xs font-bold uppercase text-slate-500">Nombre completo</label>
        <input
          className="input-base mt-1 w-full text-sm"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={syncEmailFromName}
        />

        <label className="mt-3 block text-xs font-bold uppercase text-slate-500">Correo (inicio de sesión)</label>
        <input
          className="input-base mt-1 w-full font-mono text-sm"
          value={email}
          onChange={(e) => {
            setEmailManual(true);
            setEmail(e.target.value);
          }}
        />
        {!initial && (
          <button
            type="button"
            className="mt-1 text-xs font-bold text-[var(--pos-primary)] underline"
            onClick={() => {
              setEmailManual(false);
              setEmail(suggestStaffEmail(fullName));
            }}
          >
            Regenerar desde nombre
          </button>
        )}

        <label className="mt-3 block text-xs font-bold uppercase text-slate-500">
          Contraseña {initial && "(dejar vacío para no cambiar)"}
        </label>
        <input
          type="password"
          className="input-base mt-1 w-full text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <label className="mt-3 block text-xs font-bold uppercase text-slate-500">Rol</label>
        <select
          className="input-base mt-1 w-full text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as RoleName)}
        >
          <option value="waiter">Mesero (salón y pedidos)</option>
          <option value="cashier">Cajero (caja y venta)</option>
          <option value="cook">Cocina (solo KDS)</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Administrador</option>
        </select>

        <label className="mt-3 flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Cuenta activa (puede iniciar sesión)
        </label>

        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase text-slate-500">Funciones del rol (desmarca para deshabilitar)</p>
          <ul className="mt-2 space-y-2">
            {rolePerms.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!disabled.has(p)}
                  onChange={() => togglePerm(p)}
                />
                <span>{PERM_LABELS[p] ?? p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold"
            onClick={onClose}
          >
            Cancelar
          </button>
          {onDelete && (
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-800"
              onClick={() => void onDelete()}
            >
              Eliminar usuario
            </button>
          )}
          <button
            type="button"
            className="btn-pos-primary ml-auto rounded-lg px-4 py-2 text-sm font-extrabold uppercase"
            onClick={() => void submit()}
          >
            Guardar
          </button>
        </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
