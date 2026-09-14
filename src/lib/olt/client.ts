import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { loggerDe } from "@/lib/logger";
import { CacheTtl } from "@/lib/spi40/cache";
import { leerTextoAcotado } from "@/lib/http/leer-texto-acotado";

/**
 * Herramientas OLT (smi): estado en vivo de una ONT por MAC.
 *   GET {OLT_BASE_URL}?function=ont-data&target=<mac>&json=1  → JSON plano; `status == 3` significa online.
 * El servicio es lento: se consulta en paralelo con límite de concurrencia y timeout corto, y NUNCA lanza:
 * ante cualquier fallo devuelve `online: null` (desconocido).
 */
const log = loggerDe("olt");

export interface EstadoOnt {
  mac: string;
  /** true online, false offline, null = no se pudo determinar. */
  online: boolean | null;
  /** Código `status` crudo si vino. */
  status: number | null;
  /** Resto de campos que devuelve la OLT (para mostrar en el detalle). */
  detalle: Record<string, string | number | boolean | null>;
  consultadoEn: string;
}

const respuestaSchema = z.record(z.string(), z.unknown());
/** Una respuesta de ont-data pesa unos pocos KB: cualquier cosa mayor es un error o un abuso. */
const MAX_RESPUESTA_BYTES = 1024 * 1024;

declare global {
  var __oltCache: CacheTtl<EstadoOnt> | undefined;
}
const cache: CacheTtl<EstadoOnt> = globalThis.__oltCache ?? new CacheTtl<EstadoOnt>(env.OLT_CACHE_TTL_MS);
if (process.env.NODE_ENV !== "production") globalThis.__oltCache = cache;

export function urlOnt(mac: string): string {
  const u = new URL(env.OLT_BASE_URL);
  u.searchParams.set("function", "ont-data");
  u.searchParams.set("target", mac);
  u.searchParams.set("json", "1");
  return u.toString();
}

/**
 * Semáforo global: tope de consultas simultáneas a la OLT en todo el proceso, sin importar cuántos
 * usuarios pidan a la vez (OLT_CONCURRENCIA es el tope por request; este es el de la instancia).
 */
let enVueloGlobal = 0;
const colaGlobal: Array<() => void> = [];
async function conCupoGlobal<T>(fn: () => Promise<T>): Promise<T> {
  if (enVueloGlobal >= env.OLT_MAX_EN_VUELO) await new Promise<void>((resolver) => colaGlobal.push(resolver));
  enVueloGlobal++;
  try {
    return await fn();
  } finally {
    enVueloGlobal--;
    colaGlobal.shift()?.();
  }
}

export async function getEstadoOnt(mac: string, opciones: { usarCache?: boolean; timeoutMs?: number } = {}): Promise<EstadoOnt> {
  const clave = mac.toLowerCase();
  return cache.obtener(clave, () => conCupoGlobal(() => consultar(clave, opciones.timeoutMs ?? env.OLT_TIMEOUT_MS)), {
    usarCache: opciones.usarCache ?? true,
  });
}

async function consultar(mac: string, timeoutMs: number): Promise<EstadoOnt> {
  const inicio = performance.now();
  const base: EstadoOnt = { mac, online: null, status: null, detalle: {}, consultadoEn: new Date().toISOString() };
  try {
    const r = await fetch(urlOnt(mac), { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) {
      log.warn({ mac, status: r.status, ms: ms(inicio) }, "HTTP no OK");
      return base;
    }
    const texto = (await leerTextoAcotado(r, MAX_RESPUESTA_BYTES)).trim();
    if (!texto || texto === "null" || texto === "false") {
      log.info({ mac, ms: ms(inicio) }, "sin datos para la MAC");
      return base;
    }
    const json = respuestaSchema.safeParse(JSON.parse(texto));
    if (!json.success) {
      log.warn({ mac, ms: ms(inicio) }, "respuesta no es un objeto");
      return base;
    }
    const datos = json.data;
    const statusCrudo = datos.status;
    const status = statusCrudo === undefined || statusCrudo === null || statusCrudo === "" ? null : Number(statusCrudo);
    const online = status === null || Number.isNaN(status) ? interpretarTexto(statusCrudo) : status === 3;
    const detalle: EstadoOnt["detalle"] = {};
    for (const [k, v] of Object.entries(datos)) {
      if (k === "result") continue;
      detalle[k] = typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : v === null ? null : JSON.stringify(v);
    }
    log.info({ mac, online, status, ms: ms(inicio) }, "ok");
    return { ...base, online, status: Number.isNaN(status) ? null : status, detalle };
  } catch (e) {
    const esTimeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    log.warn({ mac, ms: ms(inicio), error: String(e) }, esTimeout ? "timeout" : "error");
    return base;
  }
}

/** Fallback cuando `status` no es numérico: solo acepta "online"/"up" exactos (el legacy era demasiado laxo). */
function interpretarTexto(v: unknown): boolean | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "online" || s === "up") return true;
  if (s === "offline" || s === "down") return false;
  return null;
}

/** Consulta varias MACs en paralelo con límite de concurrencia. Nunca rechaza. */
export async function getEstadosOnt(macs: string[], opciones: { usarCache?: boolean; concurrencia?: number } = {}): Promise<Map<string, EstadoOnt>> {
  const unicas = [...new Set(macs.map((m) => m.toLowerCase()).filter(Boolean))];
  const limite = Math.max(1, opciones.concurrencia ?? env.OLT_CONCURRENCIA);
  const resultado = new Map<string, EstadoOnt>();
  let indice = 0;
  const trabajador = async () => {
    while (indice < unicas.length) {
      const mac = unicas[indice++]!;
      resultado.set(mac, await getEstadoOnt(mac, { usarCache: opciones.usarCache }));
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, unicas.length) }, trabajador));
  return resultado;
}

export function limpiarCacheOlt(): void {
  cache.limpiar();
}

function ms(inicio: number): number {
  return Math.round(performance.now() - inicio);
}
