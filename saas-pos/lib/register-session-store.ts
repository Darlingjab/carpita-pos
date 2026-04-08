/** Estado de caja en memoria (servidor). Debe estar abierta para registrar ventas. */

let registerOpen = false;
let openingFloat = 0;

export function getRegisterSessionState() {
  return { isOpen: registerOpen, openingFloat } as const;
}

export function setRegisterOpened(amount: number) {
  registerOpen = true;
  openingFloat = Math.max(0, amount);
}

export function setRegisterClosed() {
  registerOpen = false;
}
