import {
  demoCustomers,
  demoProducts,
  demoRegisterMovements,
  demoSales,
  demoTables,
} from "@/lib/mock-data";
import type { Customer, KitchenTicket, RegisterMovement, Sale } from "@/lib/types";
import type { CustomerPointsMovement } from "@/lib/types";

const sales: Sale[] = [...demoSales];
const registerMovements: RegisterMovement[] = [...demoRegisterMovements];
const kitchenTickets: KitchenTicket[] = [];
const customers: Customer[] = [...demoCustomers];
const customerPointsMovements: CustomerPointsMovement[] = [];

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
