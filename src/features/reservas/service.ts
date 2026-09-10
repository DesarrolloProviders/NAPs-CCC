import "server-only";
import { db } from "@/db/client";
import type { Reserva } from "@/db/schema";
import type { Actor } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { aFechaIso, hoy, vencimientoEn } from "@/lib/fechas";
import { loggerDe } from "@/lib/logger";
import { normalizarIdNap } from "@/lib/nap/normalizar-id-nap";
import { getPuertosNap } from "@/lib/spi40/actions";
import { esSpi40Error } from "@/lib/spi40/errors";
import type { PuertoNapWs } from "@/lib/spi40/schemas";
import * as repo from "@/features/reservas/repo";
import {
  MENSAJE_ERROR,
  type CodigoErrorReserva,
  type InstalarPuertoInput,
  type LiberarReservaInput,
  type ReservarPuertoInput,
  type ResultadoReserva,
} from "@/features/reservas/schemas";

const log = loggerDe("reservas");

/** Error de negocio con código, para traducir a ResultadoReserva. */
export class ReservaError extends Error {
  constructor(readonly codigo: CodigoErrorReserva, mensaje?: string) {
    super(mensaje ?? MENSAJE_ERROR[codigo]);
    this.name = "ReservaError";
  }
}

function esViolacionUnicaActiva(e: unknown): boolean {
  const m = e as { code?: string; constraint_name?: string; message?: string };
  return m?.code === "23505" && (m.constraint_name === "reservas_activa_por_nodo_uq" || (m.message ?? "").includes("reservas_activa_por_nodo_uq"));
}

/** Re-consulta spi40 SIN caché y devuelve el puerto si pertenece a la NAP. */
async function verificarPuertoEnSpi40(idNap: string, idNodo: number): Promise<PuertoNapWs> {
  let puertos: PuertoNapWs[];
  try {
    puertos = await getPuertosNap(idNap, { usarCache: false });
  } catch (e) {
    log.warn({ idNap, idNodo, error: esSpi40Error(e) ? e.toJSON() : String(e) }, "spi40 no disponible al verificar");
    throw new ReservaError("SPI40_NO_DISPONIBLE");
  }
  const puerto = puertos.find((p) => p.id_nodo === idNodo);
  if (!puerto) throw new ReservaError("PUERTO_NO_PERTENECE");
  return puerto;
}

function puertoTieneOnt(p: PuertoNapWs): boolean {
  return Boolean(p.mac_ont) || Boolean(p.id_cli && p.id_cli > 0);
}

/**
 * Reservar: ventas/admin. Verifica en spi40 (fresco) que el puerto pertenece a la NAP y está libre,
 * luego inserta la reserva activa + evento en una transacción. El índice único parcial resuelve carreras.
 */
export async function reservarPuerto(input: ReservarPuertoInput, actor: Actor): Promise<Reserva> {
  const puerto = await verificarPuertoEnSpi40(input.idNap, input.idNodo);
  if (puertoTieneOnt(puerto)) throw new ReservaError("PUERTO_OCUPADO");

  const dias = Math.min(input.diasVigencia ?? env.RESERVA_DIAS_DEFAULT, env.RESERVA_DIAS_MAX);
  const venceEn = vencimientoEn(dias);

  try {
    return await db.transaction(async (tx) => {
      const existente = await repo.reservaActivaPorIdNodo(input.idNodo, tx);
      if (existente) {
        if (existente.venceEn >= aFechaIso(hoy())) throw new ReservaError("PUERTO_YA_RESERVADO");
        // Activa pero vencida (el cron no corrió): se cierra como vencida y se permite la nueva.
        await repo.actualizarReserva(existente.id, { estado: "vencida", cerradaEn: new Date(), cierreMotivo: "Vencimiento al reservar de nuevo" }, tx);
        await repo.registrarEvento({ reservaId: existente.id, tipo: "vencida", actorId: actor.id }, tx);
      }
      const reserva = await repo.insertarReserva(
        {
          idNodo: input.idNodo,
          idNapNorm: normalizarIdNap(input.idNap),
          idNapOriginal: input.idNap.trim(),
          puerto: input.puerto,
          estado: "activa",
          observacion: input.observacion,
          venceEn,
          origen: "app",
          creadaPor: actor.id,
        },
        tx,
      );
      await repo.registrarEvento(
        { reservaId: reserva.id, tipo: "creada", actorId: actor.id, datos: { dias, venceEn, observacion: input.observacion, spi40: { puerto: puerto.puerto, estado: puerto.estado } } },
        tx,
      );
      log.info({ actor: actor.email, idNap: input.idNap, idNodo: input.idNodo, puerto: input.puerto, venceEn }, "reserva creada");
      return reserva;
    });
  } catch (e) {
    if (esViolacionUnicaActiva(e)) throw new ReservaError("PUERTO_YA_RESERVADO");
    throw e;
  }
}

/** Liberar: tecnico/admin. Pasa la reserva activa a 'liberada'. */
export async function liberarReserva(input: LiberarReservaInput, actor: Actor): Promise<Reserva> {
  return db.transaction(async (tx) => {
    const reserva = await repo.reservaPorId(input.reservaId, tx);
    if (!reserva) throw new ReservaError("RESERVA_NO_ENCONTRADA");
    if (reserva.estado !== "activa") throw new ReservaError("RESERVA_NO_ACTIVA");
    const actualizada = await repo.actualizarReserva(
      reserva.id,
      { estado: "liberada", cerradaPor: actor.id, cerradaEn: new Date(), cierreMotivo: input.motivo ?? null },
      tx,
    );
    await repo.registrarEvento({ reservaId: reserva.id, tipo: "liberada", actorId: actor.id, datos: { motivo: input.motivo ?? null } }, tx);
    log.info({ actor: actor.email, reservaId: reserva.id, idNodo: reserva.idNodo }, "reserva liberada");
    return actualizada;
  });
}

/**
 * Instalar: tecnico/admin. Si hay reserva activa la confirma con el nro de abonado; si no, deja una marca 'instalada'
 * (el puerto aparecerá con MAC en spi40 cuando el sistema de abonados lo registre).
 */
export async function instalarPuerto(input: InstalarPuertoInput, actor: Actor): Promise<Reserva> {
  const puerto = await verificarPuertoEnSpi40(input.idNap, input.idNodo);
  return db.transaction(async (tx) => {
    const activa = await repo.reservaActivaPorIdNodo(input.idNodo, tx);
    const ahora = new Date();
    let reserva: Reserva;
    if (activa) {
      reserva = await repo.actualizarReserva(
        activa.id,
        {
          estado: "instalada",
          nroAbonado: input.nroAbonado,
          cerradaPor: actor.id,
          cerradaEn: ahora,
          cierreMotivo: input.observacion ?? "Instalación confirmada",
        },
        tx,
      );
    } else {
      reserva = await repo.insertarReserva(
        {
          idNodo: input.idNodo,
          idNapNorm: normalizarIdNap(input.idNap),
          idNapOriginal: input.idNap.trim(),
          puerto: input.puerto,
          estado: "instalada",
          observacion: input.observacion ?? `Instalación abonado ${input.nroAbonado}`,
          venceEn: aFechaIso(hoy()),
          nroAbonado: input.nroAbonado,
          origen: "app",
          creadaPor: actor.id,
          cerradaPor: actor.id,
          cerradaEn: ahora,
          cierreMotivo: "Instalación sin reserva previa",
        },
        tx,
      );
    }
    await repo.registrarEvento(
      { reservaId: reserva.id, tipo: "instalada", actorId: actor.id, datos: { nroAbonado: input.nroAbonado, teniaReserva: Boolean(activa), spi40: { mac: puerto.mac_ont, idCli: puerto.id_cli } } },
      tx,
    );
    log.info({ actor: actor.email, reservaId: reserva.id, idNodo: input.idNodo, nroAbonado: input.nroAbonado }, "puerto instalado");
    return reserva;
  });
}

/** Traduce cualquier error a un ResultadoReserva para las Server Actions. */
export function aResultado<T>(fn: () => Promise<T>): Promise<ResultadoReserva<T>> {
  return fn()
    .then((data) => ({ ok: true as const, data }))
    .catch((e: unknown) => {
      if (e instanceof ReservaError) return { ok: false as const, codigo: e.codigo, mensaje: e.message };
      if (e instanceof Error && e.name === "PermisoDenegadoError") return { ok: false as const, codigo: "PERMISO_DENEGADO" as const, mensaje: MENSAJE_ERROR.PERMISO_DENEGADO };
      if (e instanceof Error && e.name === "ZodError") return { ok: false as const, codigo: "DATOS_INVALIDOS" as const, mensaje: MENSAJE_ERROR.DATOS_INVALIDOS };
      log.error({ error: e instanceof Error ? e.message : String(e) }, "error interno en reservas");
      return { ok: false as const, codigo: "ERROR_INTERNO" as const, mensaje: MENSAJE_ERROR.ERROR_INTERNO };
    });
}
