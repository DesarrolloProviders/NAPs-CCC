// Carga .env.local para los tests de integración. Corren contra el PostGIS real (solo lectura): no escriben nada.
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

Object.assign(process.env, { NODE_ENV: "test", LOG_LEVEL: process.env.LOG_LEVEL ?? "warn" });
