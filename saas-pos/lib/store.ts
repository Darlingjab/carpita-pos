import {
  demoCustomers,
  demoProducts,
  demoRegisterMovements,
  demoTables,
} from "@/lib/mock-data";
import type { Customer, KitchenTicket, RegisterMovement, Sale } from "@/lib/types";
import type { CustomerPointsMovement } from "@/lib/types";
import type { TableAssignment } from "@/lib/table-assignments";

/** Solo ventas creadas en esta sesión (POS). El histórico del archivo vive en `importedSalesSeed` y se une en la API. */
const sales: Sale[] = [];
const registerMovements: RegisterMovement[] = [...demoRegisterMovements];
const kitchenTickets: KitchenTicket[] = [];
const customers: Customer[] = [...demoCustomers];
const customerPointsMovements: CustomerPointsMovement[] = [];
/** Asignaciones de mesa sincronizadas en Supabase para visibilidad multi-usuario. */
const tableAssignments: Record<string, TableAssignment> = {};

export function getProducts() {
  return demoProducts;
}

export function getTables() {
  return demoTables;
}

export function getSales() {
  return sales;
}

export function addSale(sale: Sale) {
  sales.unshift(sale);
  return sale;
}

export function getRegisterMovements() {
  return registerMovements;
}

export function addRegisterMovement(movement: RegisterMovement) {
  registerMovements.unshift(movement);
  return movement;
}

export function findRegisterMovementById(id: string): RegisterMovement | undefined {
  return registerMovements.find((m) => m.id === id);
}

export function hasVoidingAdjustmentFor(targetId: string): boolean {
  return registerMovements.some(
    (m) => m.type === "adjustment" && m.voidsMovementId === targetId,
  );
}

export function getKitchenTickets() {
  return kitchenTickets;
}

export function addKitchenTicket(ticket: KitchenTicket) {
  kitchenTickets.unshift(ticket);
  return ticket;
}

export function updateKitchenTicketStatus(id: string, status: KitchenTicket["status"]) {
  const t = kitchenTickets.find((x) => x.id === id);
  if (!t) return null;
  t.status = status;
  t.readyAt = status === "ready" ? new Date().toISOString() : null;
  return t;
}

export function getCustomers() {
  return customers;
}

export function addCustomer(customer: Customer) {
  customers.unshift(customer);
  return customer;
}

export function getCustomerPointsMovements(customerId: string) {
  return customerPointsMovements.filter((m) => m.customerId === customerId);
}

export function addCustomerPointsMovement(movement: CustomerPointsMovement) {
  customerPointsMovements.unshift(movement);
  const c = customers.find((x) => x.id === movement.customerId);
  if (c) c.pointsBalance = (c.pointsBalance ?? 0) + movement.points;
  return movement;
}

export function findCustomer(customerId: string) {
  return customers.find((c) => c.id === customerId) ?? null;
}

// ---------------------------------------------------------------------------
// Table assignments (server-side, synced to Supabase)
// ---------------------------------------------------------------------------

export function getTableAssignments(): Record<string, TableAssignment> {
  return { ...tableAssignments };
}

export function upsertTableAssignmentInStore(tableId: string, assignment: TableAssignment) {
  tableAssignments[tableId] = assignment;
}

export function removeTableAssignmentFromStore(tableId: string) {
  delete tableAssignments[tableId];
}

/** Snapshot para persistencia en Supabase (servidor). */
export type StoreSnapshot = {
  sales: Sale[];
  registerMovements: RegisterMovement[];
  kitchenTickets: KitchenTicket[];
  customers: Customer[];
  customerPointsMovements: CustomerPointsMovement[];
  tableAssignments?: Record<string, TableAssignment>;
};

export function getStoreSnapshot(): StoreSnapshot {
  return {
    sales: [...sales],
    registerMovements: [...registerMovements],
    kitchenTickets: [...kitchenTickets],
    customers: [...customers],
    customerPointsMovements: [...customerPointsMovements],
    tableAssignments: { ...tableAssignments },
  };
}

export function replaceStoreSnapshot(s: StoreSnapshot) {
  sales.length = 0;
  sales.push(...s.sales);
  registerMovements.length = 0;
  registerMovements.push(...s.registerMovements);
  kitchenTickets.length = 0;
  kitchenTickets.push(...s.kitchenTickets);
  customers.length = 0;
  customers.push(...s.customers);
  customerPointsMovements.length = 0;
  customerPointsMovements.push(...s.customerPointsMovements);
  // Restore table assignments (if present in snapshot)
  Object.keys(tableAssignments).forEach((k) => delete tableAssignments[k]);
  if (s.tableAssignments) {
    Object.assign(tableAssignments, s.tableAssignments);
  }
}
