import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Menos metadatos expuestos en producción */
  poweredByHeader: false,
  /**
   * Artefacto autocontenido para Docker / VPS (`node server.js` en `.next/standalone`).
   * En Vercel se ignora; no cambia el despliegue allí.
   */
  output: "standalone",
  /**
   * No fijar `turbopack.root` aquí: con ciertas rutas/proyectos hace que `next dev` devuelva 404
   * en todas las páginas (el árbol de rutas no encuentra `app/page.tsx`).
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
