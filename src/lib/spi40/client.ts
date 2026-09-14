import "server-only";
import type { z } from "zod";
import { env } from "@/lib/env";
import { loggerDe } from "@/lib/logger";
import { leerTextoAcotado } from "@/lib/http/leer-texto-acotado";
import { CacheTtl } from "@/lib/spi40/cache";
import { DecodeError, construirUrl, decodificarRespuesta } from "@/lib/spi40/codec";
import { Spi40Error } from "@/lib/spi40/errors";
import { envelopeSchema, type Envelope } from "@/lib/spi40/schemas";

const log = loggerDe("spi40");
/** 22015 sin filtro devuelve todas las NAPs (~cientos de KB). Más que esto es un error del servicio. */
const MAX_RESPUESTA_BYTES = 10 * 1024 * 1024;

declare global {
  var __spi40Cache: CacheTtl<Envelope> | undefined;
}
const cache: CacheTtl<Envelope> = globalThis.__spi40Cache ?? new CacheTtl<Envelope>(env.SPI40_CACHE_TTL_MS);
if (process.env.NODE_ENV !== "production") globalThis.__spi40Cache = cache;

export interface OpcionesLlamada {
  timeoutMs?: number;
  /** Reintentos solo ante timeout / error de red (GET idempotente). */
  reintentos?: number;
  /** false para lecturas que deben ser frescas (saltea la caché de corta duración). */
  usarCache?: boolean;
}

/** Llamada cruda: devuelve el sobre validado. Lanza Spi40Error clasificado. */
export async function llamarSpi40(idAction: number, params: Record<string, unknown>, opciones: OpcionesLlamada = {}): Promise<Envelope> {
  const payload = { id_action: idAction, operador_ws: env.SPI40_OPERADOR_WS, ...params };
  const clave = JSON.stringify(payload);
  return cache.obtener(clave, () => ejecutarConReintentos(idAction, payload, opciones), { usarCache: opciones.usarCache ?? true });
}

/** Llamada tipada: valida cada record con el schema y devuelve solo los válidos (loguea los inválidos). */
export async function consultarSpi40<S extends z.ZodType>(
  idAction: number,
  params: Record<string, unknown>,
  recordSchema: S,
  opciones: OpcionesLlamada = {},
): Promise<{ records: z.infer<S>[]; envelope: Envelope }> {
  const envelope = await llamarSpi40(idAction, params, opciones);
  const records: z.infer<S>[] = [];
  let invalidos = 0;
  let primerIssue: unknown;
  for (const raw of envelope.records) {
    const r = recordSchema.safeParse(raw);
    if (r.success) records.push(r.data);
    else {
      invalidos++;
      primerIssue ??= r.error.issues.slice(0, 3);
    }
  }
  if (invalidos > 0) log.warn({ idAction, params, invalidos, total: envelope.records.length, primerIssue }, "records con formato inesperado");
  if (invalidos > 0 && records.length === 0 && envelope.records.length > 0) {
    throw new Spi40Error("schema", idAction, "Ningún record del webservice tiene el formato esperado");
  }
  return { records, envelope };
}

async function ejecutarConReintentos(idAction: number, payload: Record<string, unknown>, opciones: OpcionesLlamada): Promise<Envelope> {
  const reintentos = opciones.reintentos ?? 1;
  let ultimo: Spi40Error | undefined;
  for (let intento = 0; intento <= reintentos; intento++) {
    try {
      return await ejecutar(idAction, payload, opciones.timeoutMs ?? env.SPI40_TIMEOUT_MS, intento);
    } catch (e) {
      const err = e instanceof Spi40Error ? e : new Spi40Error("network", idAction, String(e), { causa: e });
      ultimo = err;
      if (!err.reintentable || intento === reintentos) throw err;
      await new Promise((r) => setTimeout(r, 300 * (intento + 1)));
    }
  }
  throw ultimo ?? new Spi40Error("network", idAction, "Error desconocido");
}

async function ejecutar(idAction: number, payload: Record<string, unknown>, timeoutMs: number, intento: number): Promise<Envelope> {
  const url = construirUrl(env.SPI40_BASE_URL, payload);
  const inicio = performance.now();
  const ctx = { idAction, params: sinIdAction(payload), intento };

  let respuesta: Response;
  try {
    respuesta = await fetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const esTimeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    log.warn({ ...ctx, ms: ms(inicio), error: String(e) }, esTimeout ? "timeout" : "error de red");
    throw new Spi40Error(esTimeout ? "timeout" : "network", idAction, esTimeout ? `Timeout de ${timeoutMs} ms` : "Error de red", { causa: e });
  }

  let texto: string;
  try {
    texto = await leerTextoAcotado(respuesta, MAX_RESPUESTA_BYTES);
  } catch (e) {
    log.error({ ...ctx, ms: ms(inicio), error: String(e) }, "respuesta demasiado grande");
    throw new Spi40Error("decode", idAction, "Respuesta demasiado grande", { causa: e });
  }
  if (!respuesta.ok) {
    log.warn({ ...ctx, ms: ms(inicio), status: respuesta.status }, "HTTP no OK");
    throw new Spi40Error("http", idAction, `HTTP ${respuesta.status}`);
  }

  let crudo: unknown;
  try {
    crudo = decodificarRespuesta(texto);
  } catch (e) {
    log.error({ ...ctx, ms: ms(inicio), muestra: e instanceof DecodeError ? e.muestra : undefined }, "respuesta no decodificable");
    throw new Spi40Error("decode", idAction, (e as Error).message, { causa: e });
  }

  const parsed = envelopeSchema.safeParse(crudo);
  if (!parsed.success) {
    log.error({ ...ctx, ms: ms(inicio), issues: parsed.error.issues.slice(0, 3) }, "sobre con formato inesperado");
    throw new Spi40Error("schema", idAction, "Formato de respuesta inesperado");
  }
  const envelope = parsed.data[0]!;
  if (!envelope.result_ok) {
    log.warn({ ...ctx, ms: ms(inicio), errors: envelope.errors }, "result_ok=false");
    throw new Spi40Error("ws_error", idAction, "El webservice devolvió result_ok=false", { detalles: envelope.errors });
  }
  log.info({ ...ctx, ms: ms(inicio), records: envelope.records.length }, "ok");
  return envelope;
}

function ms(inicio: number): number {
  return Math.round(performance.now() - inicio);
}

function sinIdAction(p: Record<string, unknown>): Record<string, unknown> {
  const { id_action: _a, operador_ws: _o, ...resto } = p;
  void _a;
  void _o;
  return resto;
}

/** Para tests y para invalidar tras una escritura. */
export function limpiarCacheSpi40(): void {
  cache.limpiar();
}
