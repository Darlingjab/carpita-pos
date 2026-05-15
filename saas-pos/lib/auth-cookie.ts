/**
 * Constante de cookie de sesión.
 *
 * Vive en un archivo aislado (sin imports de Node.js) para que el middleware
 * de Edge Runtime pueda importarla sin arrastrar `crypto`, `scrypt`, etc.
 * vía la cadena transitiva de `lib/auth.ts` → `lib/user-accounts.ts`.
 */
export const COOKIE_NAME = "pos_session";
