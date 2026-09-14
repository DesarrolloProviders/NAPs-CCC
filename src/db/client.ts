import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { env } from "@/lib/env";
import * as schema from "@/db/schema";

/** Base propia del proyecto (usuarios y sesiones). */
declare global {
  var __appSql: Sql | undefined;
}

function crear(): Sql {
  return postgres(env.APP_DATABASE_URL, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    connection: {
      application_name: "naps-ccc-app",
      // Ninguna consulta de la app debería tardar más que esto; evita que una sentencia colgada retenga la conexión.
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 10_000,
    },
  });
}

export const appSql: Sql = globalThis.__appSql ?? crear();
if (process.env.NODE_ENV !== "production") globalThis.__appSql = appSql;

export const db = drizzle(appSql, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
