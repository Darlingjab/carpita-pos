import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /** Menos metadatos expuestos en producción */
  poweredByHeader: false,
  /**
   * Artefacto autocontenido para Docker / VPS (`node server.js` en `.next/standalone`).
   * En Vercel se ignora; no cambia el despliegue allí.
   */
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
