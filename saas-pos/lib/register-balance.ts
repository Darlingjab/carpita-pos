import type { RegisterMovement } from "@/lib/types";

/** Efecto de un movimiento sobre el efectivo esperado en caja (cierres no cambian el saldo de trabajo). */
export function registerMovementCashDelta(m: RegisterMovement): number {
  if (m.type === "close") return 0;
  if (m.type === "out") return -Math.abs(Number(m.amount) || 0);
  if (m.type === "adjustment") return Number(m.amount) || 0;
  return Math.abs(Number(m.amount) || 0);
}

export function expectedRegisterCash(movements: RegisterMovement[]): number {
  return movements.reduce((acc, m) => acc + registerMovementCashDelta(m), 0);
}
