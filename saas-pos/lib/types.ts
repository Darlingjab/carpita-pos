export type BusinessType = "restaurant" | "retail";
export type RoleName = "admin" | "cashier" | "supervisor" | "waiter" | "cook";
export type SaleChannel = "counter" | "table";
export type PaymentMethod = "cash" | "card" | "transfer";

export type Permission =
  | "sales.create"
  | "sales.refund"
  | "register.open"
  | "register.close"
  | "reports.read"
  | "products.manage"
  | "users.manage"
  | "kitchen.access"
  | "favorites.manage";

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  currency: string;
  /** Dominio corto para correos de personal (ej. carpita → nombre@carpita). Demo / POS. */
  staffEmailDomain?: string;
}

export interface AppUser {
  id: string;
  businessId: string;
  fullName: string;
  email: string;
  role: RoleName;
  /** Si es false, no puede iniciar sesión. Por defecto true. */
  enabled?: boolean;
}

/** Registro interno de cuenta de usuario. */
export interface UserAccountRow {
  id: string;
  businessId: string;
  fullName: string;
  email: string;
  role: RoleName;
  /**
   * Contraseña hasheada con scrypt.
   * Formato: $scrypt$N=16384,r=8,p=1$<salt_hex>$<hash_hex>
   */
  passwordHash?: string;
  /**
   * @deprecated Solo presente en datos legacy / migración.
   * Se reemplaza por passwordHash en el primer login o cambio de contraseña.
   */
  passwordPlain?: string;
  enabled: boolean;
  /** Permisos del rol que están desactivados para este usuario */
  disabledPermissions: Permission[];
}

export interface Customer {
  id: string;
  businessId: string;
  /** Nombre visible en POS y reportes */
  name: string;
  phone?: string | null;
  email?: string | null;
  pointsBalance: number;
  createdAt: string;
}

export interface CustomerPointsMovement {
  id: string;
  businessId: string;
  customerId: string;
  /** Venta / ajuste manual */
  type: "earn" | "redeem" | "adjust";
  /** Puntos (+ gana, - canje/ajuste) */
  points: number;
  /** Referencia (sale_id, nota, etc.) */
  ref: string | null;
  createdAt: string;
}

export interface ProductCategory {
  id: string;
  businessId: string;
  name: string;
  parentId: string | null;
}

export interface Product {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  sku: string;
  price: number;
  isFavorite: boolean;
  /** Color del botón en favoritos del POS (0–5). Opcional; por defecto 0. */
  favoriteColorIndex?: number;
  /** Si el producto está disponible para venta en el POS */
  isActive: boolean;
  /** Costo (gestión; opcional en importación) */
  cost?: number;
  /** Menú de temporada (pestaña dedicada) */
  isSeasonal?: boolean;
  /** Descontinuado / histórico (no aparece en venta normal) */
  isArchived?: boolean;
}

export interface DiningTable {
  id: string;
  businessId: string;
  label: string;
  seats: number;
  isActive: boolean;
}

export interface SaleItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SalePayment {
  method: PaymentMethod;
  amount: number;
}

export type DiscountType = "employee" | "owner" | "custom";

export interface Sale {
  id: string;
  businessId: string;
  channel: SaleChannel;
  tableId: string | null;
  customerId?: string | null;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  payments: SalePayment[];
  createdAt: string;
  createdBy: string;
  /** Cliente en mesa / mostrador (p. ej. Consumidor final). */
  customerName?: string | null;
  /** Mesero que registró la venta (snapshot al cobrar). */
  serverId?: string | null;
  serverName?: string | null;
  /** Descuento como % del subtotal (0–100). */
  discountPercent?: number | null;
  discountType?: DiscountType | null;
  /** Autorización / nombre para auditoría. */
  discountDescription?: string | null;
  /** Efectivo recibido (solo referencia en demo). */
  tenderedCash?: number | null;
  changeGiven?: number | null;
}

export interface RegisterMovement {
  id: string;
  businessId: string;
  type: "open" | "in" | "out" | "close" | "adjustment";
  amount: number;
  note: string | null;
  createdAt: string;
  createdBy: string;
  /** Solo ajustes: anula el efecto en caja del movimiento indicado (trazabilidad). */
  voidsMovementId?: string | null;
}

export type KitchenTicketStatus = "pending" | "preparing" | "ready";

export interface KitchenTicket {
  id: string;
  businessId: string;
  channel: SaleChannel;
  tableId: string | null;
  tableLabel: string | null;
  counterOrderId: string | null;
  items: SaleItem[];
  status: KitchenTicketStatus;
  createdAt: string;
  readyAt?: string | null;
}
