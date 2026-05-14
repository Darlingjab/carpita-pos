/**
 * Rate limiter en memoria para proteger endpoints sensibles.
 * Usa una ventana deslizante simple por IP (o clave arbitraria).
 * Compatible con entornos serverless (el estado se resetea entre cold starts,
 * lo que es suficiente para mitigar ataques de fuerza bruta básicos).
 */

type Entry = { count: number; windowStart: number };
const store = new Map<string, Entry>();

/**
 * Verifica si la clave dada ha excedido el límite en la ventana de tiempo.
 * @param key    Identificador único (ej: IP del cliente)
 * @param limit  Máximo de intentos permitidos en la ventana
 * @param windowMs Tamaño de la ventana en milisegundos
 * @returns `true` si se debe bloquear la solicitud (límite superado)
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  if (entry.count > limit) {
    return true;
  }
  return false;
}
