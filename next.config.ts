import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen Docker chica: .next/standalone (ver Dockerfile)
  output: "standalone",
  // Paquetes con binarios/workers que no deben pasar por el bundler del servidor
  serverExternalPackages: ["pino", "pino-pretty", "postgres"],
  typedRoutes: true,
};

export default nextConfig;
