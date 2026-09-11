import "server-only";
import { z } from "zod";

/**
 * Variables de entorno validadas. Falla al arrancar si falta algo, en vez de
 * fallar en la primera request. Solo se importa del lado servidor.
 */
const numero = (def: number) => z.coerce.number().int().positive().default(def);

const esquema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  APP_DATABASE_URL: z.string().url(),
  APP_DATABASE_URL_TEST: z.string().url().optional(),

  GIS_DATABASE_URL: z.string().url(),
  GIS_SCHEMA: z.string().min(1).default("public"),

  SPI40_BASE_URL: z.string().url(),
  SPI40_OPERADOR_WS: numero(1),
  SPI40_TIMEOUT_MS: numero(8000),
  SPI40_CACHE_TTL_MS: numero(15000),

  OLT_BASE_URL: z.string().url(),
  OLT_TIMEOUT_MS: numero(30000),
  OLT_CONCURRENCIA: numero(8),
  OLT_CACHE_TTL_MS: numero(300000),

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET debe tener al menos 32 caracteres"),
  BETTER_AUTH_URL: z.string().url(),
  ADMIN_SEED_EMAIL: z.string().email(),
  ADMIN_SEED_PASSWORD: z.string().min(10),

  BUSQUEDA_RADIO_DEFAULT_M: numero(500),
  BUSQUEDA_RADIO_MAX_M: numero(5000),
  BUSQUEDA_MAX_RESULTADOS: numero(500),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  TZ: z.string().default("America/Argentina/Tucuman"),
});

export type Env = z.infer<typeof esquema>;

function cargar(): Env {
  const resultado = esquema.safeParse(process.env);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuración de entorno inválida:\n${detalle}\nRevisá .env.local (ver .env.example).`);
  }
  return resultado.data;
}

export const env: Env = cargar();
