import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests de integración: usan el PostGIS local (GIS_DATABASE_URL) y la base de test (APP_DATABASE_URL_TEST).
// Requieren `docker compose up -d app-db` acá y `docker compose up -d postgis` en ../legacy-php.
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
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
