import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen Docker chica: .next/standalone (ver Dockerfile)
  output: "standalone",
  // Paquetes con binarios/workers que no deben pasar por el bundler del servidor
  // drizzle-orm y better-auth también externos para que el standalone los deje en node_modules (los usan docker/migrate.mjs y seed-admin.mjs)
  serverExternalPackages: ["pino", "pino-pretty", "postgres", "drizzle-orm", "better-auth"],
  typedRoutes: true,
  // Hay un package-lock.json suelto en OneDrive\Desktop: fijamos la raíz para que Turbopack no lo considere.
  turbopack: { root: __dirname },
};

export default nextConfig;
