const STORAGE_KEY = "pos_offline_sale_queue_v1";
const MAX_QUEUE = 250;

export type QueuedSalePayload = Record<string, unknown>;

export type QueuedSale = {
  id: string;
  payload: QueuedSalePayload;
  createdAt: string;
  attempts: number;
};

function emitChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pos-offline-queue-changed"));
}

export function readOfflineSaleQueue(): QueuedSale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is QueuedSale =>
        x &&
        typeof x === "object" &&
        typeof (x as QueuedSale).id === "string" &&
        typeof (x as QueuedSale).payload === "object" &&
        (x as QueuedSale).payload !== null,
    );
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedSale[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  } catch {
    // quota / private mode
  }
  emitChanged();
}

export function pendingOfflineSaleCount(): number {
  return readOfflineSaleQueue().length;
}

export function enqueueOfflineSale(payload: QueuedSalePayload): string {
  const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const q = readOfflineSaleQueue();
  q.push({
    id,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  const trimmed = q.length > MAX_QUEUE ? q.slice(-MAX_QUEUE) : q;
  writeQueue(trimmed);
  return id;
}

let flushing = false;

export async function flushOfflineSaleQueue(): Promise<void> {
  if (typeof window === "undefined") return;
  if (flushing) return;
  if (!navigator.onLine) return;

  const initial = readOfflineSaleQueue();
  if (initial.length === 0) return;

  flushing = true;
  const remaining: QueuedSale[] = [];

  try {
    for (const item of initial) {
      try {
        const res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) continue;
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "register_closed") {
          remaining.push({ ...item, attempts: item.attempts + 1 });
          continue;
        }
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          console.warn("[offline-sale-queue] venta descartada (rechazo servidor):", item.id, data);
          continue;
        }
        remaining.push({ ...item, attempts: item.attempts + 1 });
      } catch {
        remaining.push({ ...item, attempts: item.attempts + 1 });
      }
    }

    writeQueue(remaining);
    if (remaining.length < initial.length) {
      window.dispatchEvent(new CustomEvent("pos-sales-updated"));
    }
  } finally {
    flushing = false;
  }
}
