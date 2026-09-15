import type { NextConfig } from "next";

const esProd = process.env.NODE_ENV === "production";

/** Origen del geocodificador que llama el navegador (Nominatim público salvo NEXT_PUBLIC_GEOCODER_URL). */
function origenGeocoder(): string {
  const url = process.env.NEXT_PUBLIC_GEOCODER_URL;
  if (!url) return "https://nominatim.openstreetmap.org";
  const origen = new URL(url).origin;
  if (esProd && !origen.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_GEOCODER_URL debe ser https:// en producción (la app se sirve por HTTPS y el navegador bloquea contenido mixto).");
  }
  return origen;
}

/**
 * Content-Security-Policy. Sin nonce por ahora: el App Router inyecta scripts inline, así que hace falta
 * 'unsafe-inline' en script-src (mejora pendiente: nonce por request desde proxy.ts).
 * Leaflet aplica estilos inline (style-src) y los tiles vienen de OSM (img-src).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  `connect-src 'self' ${origenGeocoder()}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Sin `upgrade-insecure-requests`: la app también se sirve por http:// directo en la LAN (puerto 3110) y esa directiva
  // hacía que el navegador pidiera CSS/JS por https y los descartara. HTTPS lo impone el proxy del host cuando corresponde.
].join("; ");

const cabecerasSeguridad = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Que las coordenadas de /buscar?lat&lon no viajen en el Referer hacia OSM/Nominatim.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // BuscarForm usa la geolocalización del navegador ("Usar mi ubicación").
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Imagen Docker chica: .next/standalone (ver Dockerfile)
  output: "standalone",
  poweredByHeader: false,
  // Paquetes con binarios/workers que no deben pasar por el bundler del servidor
  // drizzle-orm y better-auth también externos para que el standalone los deje en node_modules (los usan docker/migrate.mjs y seed-admin.mjs)
  serverExternalPackages: ["pino", "pino-pretty", "postgres", "drizzle-orm", "better-auth"],
  typedRoutes: true,
  // Hay un package-lock.json suelto en OneDrive\Desktop: fijamos la raíz para que Turbopack no lo considere.
  turbopack: { root: __dirname },
  // Solo afecta a `next dev` (pruebas por túnel ngrok). No usar `module.exports` en este archivo: Next lo transpila a
  // CommonJS y una asignación así reemplaza el export default completo (se perdían standalone, cabeceras, etc.).
  allowedDevOrigins: ["untotalled-stringily-nevada.ngrok-free.dev"],
  async headers() {
    return [{ source: "/(.*)", headers: cabecerasSeguridad }];
  },
};

export default nextConfig;
