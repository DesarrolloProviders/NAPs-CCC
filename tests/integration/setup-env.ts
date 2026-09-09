// Carga .env.local para los tests de integración y apunta la base propia a la de test.
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

if (process.env.APP_DATABASE_URL_TEST) {
  process.env.APP_DATABASE_URL = process.env.APP_DATABASE_URL_TEST;
}
Object.assign(process.env, { NODE_ENV: "test", LOG_LEVEL: process.env.LOG_LEVEL ?? "warn" });
