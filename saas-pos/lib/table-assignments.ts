export type TableAssignment = {
  serverId: string;
  serverName: string;
  clientName: string;
  customerId?: string | null;
  openedAt: string;
};

const KEY = "pos_table_assign_v1";

// ---------------------------------------------------------------------------
// localStorage — cache local (respaldo offline y UI optimista)
// ---------------------------------------------------------------------------

export function loadTableAssignments(): Record<string, TableAssignment> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, TableAssignment>) : {};
  } catch {
    return {};
  }
}

export function saveTableAssignments(map: Record<string, TableAssignment>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(map));
}

// ---------------------------------------------------------------------------
// API del servidor — fuente de verdad compartida entre usuarios y dispositivos
// ---------------------------------------------------------------------------

/**
 * Obtiene las asignaciones de mesa desde el servidor y las fusiona con el
 * localStorage local. El servidor es la fuente de verdad.
 */
export async function fetchTableAssignments(): Promise<Record<string, TableAssignment>> {
  try {
    const res = await fetch("/api/tables/assignments");
    if (!res.ok) throw new Error("fetch failed");
    const data = (await res.json()) as { data?: Record<string, TableAssignment> };
    const serverMap = data.data ?? {};
    // Persistir en localStorage como cache
    saveTableAssignments(serverMap);
    return serverMap;
  } catch {
    // Si la red falla, usar cache local
    return loadTableAssignments();
  }
}

/**
 * Crea o actualiza una asignación en el servidor y en localStorage.
 * Optimista: actualiza localStorage primero para que la UI sea inmediata.
 */
export async function upsertTableAssignment(
  tableId: string,
  partial: Omit<TableAssignment, "openedAt"> & { openedAt?: string },
): Promise<void> {
  const assignment: TableAssignment = {
    serverId: partial.serverId,
    serverName: partial.serverName,
    clientName: partial.clientName,
    customerId: partial.customerId ?? null,
    openedAt: partial.openedAt ?? new Date().toISOString(),
  };

  // Actualización optimista en localStorage
  const map = loadTableAssignments();
  map[tableId] = assignment;
  saveTableAssignments(map);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pos-table-assignments-updated"));
  }

  // Sincronizar con el servidor (fuente de verdad)
  try {
    await fetch("/api/tables/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, assignment }),
    });
  } catch {
    // Si falla el servidor, queda guardado en localStorage hasta la próxima sync
  }
}

/**
 * Elimina una asignación del servidor y del localStorage.
 */
export async function removeTableAssignment(tableId: string): Promise<void> {
  // Actualización optimista en localStorage
  const map = loadTableAssignments();
  delete map[tableId];
  saveTableAssignments(map);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pos-table-assignments-updated"));
  }

  // Sincronizar con el servidor
  try {
    await fetch(`/api/tables/assignments/${tableId}`, { method: "DELETE" });
  } catch {
    // Si falla, la próxima sync desde el servidor restaurará el estado correcto
  }
}
