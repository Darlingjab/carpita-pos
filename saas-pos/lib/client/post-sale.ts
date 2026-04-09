import { enqueueOfflineSale } from "@/lib/offline-sale-queue";

export type PostSaleBody = Record<string, unknown>;

export type PostSaleClientResult =
  | { kind: "posted"; data: unknown }
  | { kind: "queued"; queueId: string }
  | { kind: "error"; error: string; message?: string };

/**
 * Envía POST /api/sales. Si no hay red o falla la petición de red, guarda el cuerpo en cola local.
 * Errores de negocio (caja cerrada, 403, etc.) no se encolan.
 */
export async function postSaleWithOfflineQueue(body: PostSaleBody): Promise<PostSaleClientResult> {
  let res: Response;
  try {
    res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    const queueId = enqueueOfflineSale(body);
    return { kind: "queued", queueId };
  }

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    data?: unknown;
    cloudSynced?: boolean;
  };

  if (res.ok) {
    return { kind: "posted", data: data.data };
  }

  if (res.status === 400 || res.status === 401 || res.status === 403) {
    return {
      kind: "error",
      error: data.error ?? "request_failed",
      message: data.message,
    };
  }

  if (res.status >= 500) {
    const queueId = enqueueOfflineSale(body);
    return { kind: "queued", queueId };
  }

  const queueId = enqueueOfflineSale(body);
  return { kind: "queued", queueId };
}
