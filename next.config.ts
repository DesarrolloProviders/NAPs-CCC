import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen Docker chica: .next/standalone (ver Dockerfile)
  output: "standalone",
  // Paquetes con binarios/workers que no deben pasar por el bundler del servidor
  serverExternalPackages: ["pino", "pino-pretty", "postgres"],
  typedRoutes: true,
  // Hay un package-lock.json suelto en OneDrive\Desktop: fijamos la raíz para que Turbopack no lo considere.
  turbopack: { root: __dirname },
};

export default nextConfig;
