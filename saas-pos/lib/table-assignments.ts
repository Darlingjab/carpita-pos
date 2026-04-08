export type TableAssignment = {
  serverId: string;
  serverName: string;
  clientName: string;
  customerId?: string | null;
  openedAt: string;
};

const KEY = "pos_table_assign_v1";

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

export function upsertTableAssignment(
  tableId: string,
  partial: Omit<TableAssignment, "openedAt"> & { openedAt?: string },
) {
  const map = loadTableAssignments();
  map[tableId] = {
    serverId: partial.serverId,
    serverName: partial.serverName,
    clientName: partial.clientName,
    customerId: partial.customerId ?? null,
    openedAt: partial.openedAt ?? new Date().toISOString(),
  };
  saveTableAssignments(map);
  window.dispatchEvent(new CustomEvent("pos-table-assignments-updated"));
}

export function removeTableAssignment(tableId: string) {
  const map = loadTableAssignments();
  delete map[tableId];
  saveTableAssignments(map);
  window.dispatchEvent(new CustomEvent("pos-table-assignments-updated"));
}
