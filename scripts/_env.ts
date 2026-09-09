// Carga de entorno para scripts CLI (tsx). Se importa primero en cada script.
// Ejecutar con: tsx -C react-server scripts/<script>.ts  (la condición react-server evita que "server-only" lance error fuera de Next)
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "warn";
