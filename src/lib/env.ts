import "server-only";
import { z } from "zod";

/**
 * Variables de entorno validadas. Falla al arrancar si falta algo, en vez de
 * fallar en la primera request. Solo se importa del lado servidor.
 */
const numero = (def: number) => z.coerce.number().int().positive().default(def);

const esquema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    APP_DATABASE_URL: z.string().url(),

    GIS_DATABASE_URL: z.string().url(),
    // Va al search_path de la conexión: solo identificadores simples.
    GIS_SCHEMA: z
      .string()
      .regex(/^[a-z_][a-z0-9_]*$/, "GIS_SCHEMA debe ser un identificador simple (minúsculas, dígitos y _)")
      .default("public"),

    SPI40_BASE_URL: z.string().url(),
    SPI40_OPERADOR_WS: numero(1),
    SPI40_TIMEOUT_MS: numero(8000),
    SPI40_CACHE_TTL_MS: numero(15000),

    OLT_BASE_URL: z.string().url(),
    OLT_TIMEOUT_MS: numero(30000),
    /** Consultas paralelas a la OLT por request. */
    OLT_CONCURRENCIA: numero(8),
    /** Consultas paralelas a la OLT en todo el proceso (todos los usuarios). */
    OLT_MAX_EN_VUELO: numero(16),
    OLT_CACHE_TTL_MS: numero(300000),
    /** Mínimo entre dos "actualizar estado OLT" del mismo usuario para la misma NAP. */
    OLT_REFRESH_MIN_MS: numero(30000),

    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET debe tener al menos 32 caracteres"),
    BETTER_AUTH_URL: z.string().url(),
    /** Segundos que la sesión se sirve desde la cookie firmada sin consultar la base (afecta cuánto tarda en aplicarse una baja). */
    AUTH_COOKIE_CACHE_S: numero(60),

    // Solo los usan docker/seed-admin.mjs y scripts/seed-admin.ts; la app no los necesita.
    ADMIN_SEED_EMAIL: z.string().email().optional(),
    ADMIN_SEED_PASSWORD: z.string().min(4).optional(),

    /** Token para GET /api/health?deep=1 (Authorization: Bearer). Sin token, deep exige sesión de admin. */
    HEALTH_TOKEN: z.string().min(32).optional(),
    /** MAC de una ONT conocida para el check profundo de la OLT. Si falta, se omite ese check. */
    HEALTH_OLT_MAC: z
      .string()
      .regex(/^[0-9a-f]{12}$/i, "HEALTH_OLT_MAC: 12 dígitos hexadecimales sin separadores")
      .optional(),

    BUSQUEDA_RADIO_DEFAULT_M: numero(500),
    BUSQUEDA_RADIO_MAX_M: numero(5000),
    BUSQUEDA_MAX_RESULTADOS: numero(500),

    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    // TZ la lee Node directamente (Dockerfile / SO); la zona de negocio para formatear está en src/lib/fechas.ts.
  });
// BETTER_AUTH_URL puede ser http:// (pruebas en la LAN, acceso directo al puerto). HTTPS lo termina el proxy del host
// (Apache/nginx); cuando la URL pública es https, las cookies de sesión pasan a ser Secure (src/lib/auth/auth.ts).

export type Env = z.infer<typeof esquema>;

function cargar(): Env {
  // Una variable vacía (`HEALTH_TOKEN=` en un .env) cuenta como no definida, no como un valor inválido.
  const crudo = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ""));
  const resultado = esquema.safeParse(crudo);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuración de entorno inválida:\n${detalle}\nRevisá .env.local (ver .env.example).`);
  }
  return resultado.data;
}

export const env: Env = cargar();
