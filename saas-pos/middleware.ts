import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/auth-cookie";

const PUBLIC_PATHS = ["/", "/login"];

/** Rutas API públicas (sin cookie). El resto de `/api/*` exige sesión. */
const PUBLIC_API_PREFIXES = ["/api/auth/login", "/api/auth/logout"];

const DEV_SECRET = "dev-secret-carpita-pos-no-usar-en-produccion";

/** Convierte un string hex a Uint8Array con ArrayBuffer explícito (requerido por Web Crypto). */
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Verifica la firma HMAC-SHA256 del token usando Web Crypto (Edge Runtime compatible).
 * Token: `<userId>|<expiresUnixSec>|<hmac-sha256-hex>`
 */
async function verifySessionEdge(token: string): Promise<boolean> {
  if (!token) return false;
  const parts = token.split("|");
  if (parts.length !== 3) return false;
  const [userId, expiresStr, sig] = parts;
  if (!userId) return false;

  const expires = Number(expiresStr);
  if (Number.isNaN(expires) || Math.floor(Date.now() / 1000) > expires) return false;

  const secret = process.env.SESSION_SECRET?.trim() || DEV_SECRET;
  const payload = `${userId}|${expiresStr}`;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = hexToBytes(sig);
    const payloadBytes = new TextEncoder().encode(payload);
    return await crypto.subtle.verify("HMAC", key, sigBytes, payloadBytes);
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api")) {
    if (req.method === "OPTIONS") {
      return NextResponse.next();
    }
    const isPublicApi = PUBLIC_API_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (isPublicApi) {
      return NextResponse.next();
    }
    const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
    if (!await verifySessionEdge(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
  if (!await verifySessionEdge(token)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
