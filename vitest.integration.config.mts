import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests de integración: consultan el PostGIS real (GIS_DATABASE_URL de .env.local), solo lectura.
// Requieren acceso de red al servidor GIS. No tocan la base propia.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/mocks/server-only.ts"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/integration/setup-env.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
