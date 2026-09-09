import "server-only";
import postgres, { type Sql } from "postgres";
import { env } from "@/lib/env";

/**
 * Conexión al PostGIS de NAPs (servidor GIS / QGIS). SOLO LECTURA.
 * `default_transaction_read_only` hace que cualquier escritura accidental falle
 * aunque el usuario tenga permisos.
 */
declare global {
  var __gisSql: Sql | undefined;
}

function crear(): Sql {
  return postgres(env.GIS_DATABASE_URL, {
    max: 4,
    idle_timeout: 30,
    connect_timeout: 10,
    connection: {
      application_name: "naps-ccc-gis",
      default_transaction_read_only: true,
      search_path: `${env.GIS_SCHEMA},public`,
    },
    // PostGIS devuelve numeric como string: lo convertimos a number.
    types: { numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: Number } },
  });
}

// Reutiliza la conexión entre recargas de Next en desarrollo.
export const gisSql: Sql = globalThis.__gisSql ?? crear();
if (process.env.NODE_ENV !== "production") globalThis.__gisSql = gisSql;
