import {
  AppUser,
  Customer,
  Product,
  RegisterMovement,
  RoleName,
} from "@/lib/types";
import { importedBusiness, importedBusinessId } from "@/lib/data/imported-business";
import { importedCategories, importedProducts } from "@/lib/data/imported-catalog";
import { importedTables } from "@/lib/data/imported-tables";

export const rolePermissions: Record<RoleName, string[]> = {
  admin: [
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
  ],
  supervisor: [
    "sales.create",
    "register.open",
    "register.close",
    "register.movements",
    "reports.read",
    "kitchen.access",
  ],
  cashier: ["sales.create", "register.open", "register.close", "register.movements", "kitchen.access"],
  /** Mesero: pedidos en salón / POS y vista cocina (KDS) si la usa el local. */
  waiter: ["sales.create", "kitchen.access"],
  /** Cocina: solo pantalla KDS. */
  cook: ["kitchen.access"],
};

export const demoBusiness = importedBusiness;
export const demoBusinessId = importedBusinessId;

export const demoUsers: AppUser[] = [
  {
    id: "usr_admin",
    businessId: importedBusinessId,
    fullName: "Administrador Carpita",
    email: "admin@carpita",
    role: "admin",
  },
  {
    id: "usr_cashier",
    businessId: importedBusinessId,
    fullName: "Cajero Carpita",
    email: "cajero@carpita",
    role: "cashier",
  },
  {
    id: "usr_supervisor",
    businessId: importedBusinessId,
    fullName: "Sam Supervisor",
    email: "supervisor@demo.local",
    role: "supervisor",
  },
];

export const demoCategories = importedCategories;
export const demoProducts: Product[] = importedProducts;
export const demoTables = importedTables;

export const demoCustomers: Customer[] = [
  {
    id: "cus_001",
    businessId: importedBusinessId,
    name: "Consumidor final",
    phone: null,
    email: null,
    pointsBalance: 0,
    createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
  },
  {
    id: "cus_002",
    businessId: importedBusinessId,
    name: "María López",
    phone: "0999999999",
    email: null,
    pointsBalance: 120,
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: "cus_003",
    businessId: importedBusinessId,
    name: "Carlos Pérez",
    phone: null,
    email: "carlos@example.com",
    pointsBalance: 45,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

/** Movimientos demo + historial repartido en el último mes (para arqueos / informes). */
export const demoRegisterMovements: RegisterMovement[] = [
  {
    id: "mov_hist_close_25d",
    businessId: importedBusinessId,
    type: "close",
    amount: 912.5,
    note: "Cierre turno noche",
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    createdBy: "usr_supervisor",
  },
  {
    id: "mov_hist_open_25d",
    businessId: importedBusinessId,
    type: "open",
    amount: 200,
    note: "Apertura — base $200.00",
    createdAt: new Date(Date.now() - 26 * 86400000).toISOString(),
    createdBy: "usr_admin",
  },
  {
    id: "mov_hist_out_18d",
    businessId: importedBusinessId,
    type: "out",
    amount: 40,
    note: "Compra urgente suministros",
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    createdBy: "usr_supervisor",
  },
  {
    id: "mov_hist_close_12d",
    businessId: importedBusinessId,
    type: "close",
    amount: 1040,
    note: "Cierre semanal",
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    createdBy: "usr_admin",
  },
  {
    id: "mov_hist_open_12d",
    businessId: importedBusinessId,
    type: "open",
    amount: 175,
    note: "Apertura — base $175.00",
    createdAt: new Date(Date.now() - 13 * 86400000).toISOString(),
    createdBy: "usr_cashier",
  },
  {
    id: "mov_hist_in_10d",
    businessId: importedBusinessId,
    type: "in",
    amount: 320.75,
    note: "Ingreso de caja (ejemplo histórico)",
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    createdBy: "usr_cashier",
  },
  {
    id: "mov_open_1",
    businessId: importedBusinessId,
    type: "open",
    amount: 150,
    note: "Apertura — base $150.00 (sesión actual semilla)",
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    createdBy: "usr_admin",
  },
  {
    id: "mov_in_1",
    businessId: importedBusinessId,
    type: "in",
    amount: 50,
    note: "Petty cash top-up",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    createdBy: "usr_supervisor",
  },
];
