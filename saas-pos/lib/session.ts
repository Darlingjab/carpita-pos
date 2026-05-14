/**
 * Firma y verificación de tokens de sesión (solo servidor / Node.js).
 * Token: `<userId>|<expiresUnixSec>|<hmac-sha256-hex>`
 *
 * Requiere SESSION_SECRET en las variables de entorno.
 * En desarrollo usa una clave fija con advertencia en consola.
 */
import { createHmac, timingSafeEqual } from "crypto";

const DEV_SECRET = "dev-secret-carpita-pos-no-usar-en-produccion";

function getSecret(): string {
  const s = process.env.SESSION_SECRET?.trim() ?? "";
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[session] SESSION_SECRET no está configurado en producción.");
    }
    console.warn(
      "[session] SESSION_SECRET no está configurado — usando clave de desarrollo. Configurar antes del go-live.",
    );
    return DEV_SECRET;
  }
  return s;
}

/**
 * Genera un token firmado que incluye el userId y un tiempo de expiración.
 * @param maxAgeSeconds Vida útil en segundos (por defecto 12 h).
 */
export function signSession(userId: string, maxAgeSeconds = 60 * 60 * 12): string {
  const secret = getSecret();
  const expires = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payload = `${userId}|${expires}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}|${sig}`;
}

/**
 * Verifica la firma y la expiración del token.
 * @returns El userId si el token es válido, o null si es inválido / expirado.
 */
export function verifySession(token: string): string | null {
  if (!token) return null;
  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const [userId, expiresStr, sig] = parts;
  if (!userId) return null;

  const expires = Number(expiresStr);
  if (Number.isNaN(expires) || Math.floor(Date.now() / 1000) > expires) return null;

  const secret = process.env.SESSION_SECRET?.trim() || DEV_SECRET;
  const payload = `${userId}|${expiresStr}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  // HMAC-SHA256 siempre produce 64 hex chars
  if (sig.length !== expected.length) return null;
  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }

  return userId;
}
