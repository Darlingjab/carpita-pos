/**
 * Hash y verificación de contraseñas con scrypt (Node built-in, sin dependencias externas).
 * Formato: $scrypt$N=16384,r=8,p=1$<salt_hex>$<hash_hex>
 */
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

const KEY_LEN = 32;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

/** Genera un hash seguro de la contraseña en texto plano. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, KEY_LEN, SCRYPT_PARAMS).toString("hex");
  return `$scrypt$N=16384,r=8,p=1$${salt}$${hash}`;
}

/**
 * Verifica que `plain` corresponde al hash almacenado.
 * Resistente a timing attacks via timingSafeEqual.
 * Devuelve false si el hash tiene formato incorrecto.
 */
export function verifyPassword(plain: string, hash: string): boolean {
  if (!hash.startsWith("$scrypt$")) return false;
  // Formato: ['', 'scrypt', 'N=...,r=...,p=...', salt, storedHash]
  const parts = hash.split("$");
  if (parts.length !== 5) return false;
  const salt = parts[3];
  const stored = parts[4];
  try {
    const computed = scryptSync(plain, salt, KEY_LEN, SCRYPT_PARAMS).toString("hex");
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(stored, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
