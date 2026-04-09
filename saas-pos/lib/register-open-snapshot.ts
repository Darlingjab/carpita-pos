const KEY = "pos_register_open_snapshot_v1";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

type Snap = { isOpen: boolean; at: number };

function read(): Snap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Snap;
    if (typeof p.isOpen !== "boolean" || typeof p.at !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

export function rememberRegisterOpen(isOpen: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ isOpen, at: Date.now() } satisfies Snap));
  } catch {
    // ignore
  }
}

/** Si hace poco la caja estaba abierta (útil para cobrar offline sin poder llamar a la API). */
export function canAssumeRegisterOpenOffline(): boolean {
  const s = read();
  if (!s?.isOpen) return false;
  return Date.now() - s.at < MAX_AGE_MS;
}
