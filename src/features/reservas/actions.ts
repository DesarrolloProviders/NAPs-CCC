"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import * as repo from "@/features/reservas/repo";
import {
  instalarPuertoSchema,
  liberarReservaSchema,
  reservarPuertoSchema,
  type ResultadoReserva,
} from "@/features/reservas/schemas";
import { aResultado, instalarPuerto as instalarSvc, liberarReserva as liberarSvc, reservarPuerto as reservarSvc } from "@/features/reservas/service";

export interface ReservaResumen {
  id: number;
  idNodo: number;
  puerto: number | null;
  estado: string;
  venceEn: string;
  observacion: string;
}

function resumen(r: { id: number; idNodo: number; puerto: number | null; estado: string; venceEn: string; observacion: string }): ReservaResumen {
  return { id: r.id, idNodo: r.idNodo, puerto: r.puerto, estado: r.estado, venceEn: r.venceEn, observacion: r.observacion };
}

function revalidar(idNap: string) {
  revalidatePath(`/naps/${encodeURIComponent(idNap)}`);
}

export async function reservarPuerto(input: unknown): Promise<ResultadoReserva<ReservaResumen>> {
  return aResultado(async () => {
    const actor = await requireRole("reservar");
    const datos = reservarPuertoSchema.parse(input);
    const r = await reservarSvc(datos, actor);
    revalidar(datos.idNap);
    return resumen(r);
  });
}

export async function liberarReserva(input: unknown, idNap: string): Promise<ResultadoReserva<ReservaResumen>> {
  return aResultado(async () => {
    const actor = await requireRole("liberar");
    const datos = liberarReservaSchema.parse(input);
    const r = await liberarSvc(datos, actor);
    revalidar(idNap);
    return resumen(r);
  });
}

export async function instalarPuerto(input: unknown): Promise<ResultadoReserva<ReservaResumen>> {
  return aResultado(async () => {
    const actor = await requireRole("instalar");
    const datos = instalarPuertoSchema.parse(input);
    const r = await instalarSvc(datos, actor);
    revalidar(datos.idNap);
    return resumen(r);
  });
}

export interface HistorialItem {
  id: number;
  estado: string;
  observacion: string;
  venceEn: string;
  nroAbonado: string | null;
  origen: string;
  creadaEn: string;
  creadaPor: string | null;
  cerradaEn: string | null;
  cierreMotivo: string | null;
  eventos: { tipo: string; actor: string | null; creadoEn: string }[];
}

/** Historial de reservas de un puerto (cualquier rol con sesión). */
export async function obtenerHistorialPuerto(idNodo: number): Promise<ResultadoReserva<HistorialItem[]>> {
  return aResultado(async () => {
    await requireRole("ver");
    const filas = await repo.historialPorIdNodo(Number(idNodo));
    return filas.map((r) => ({
      id: r.id,
      estado: r.estado,
      observacion: r.observacion,
      venceEn: r.venceEn,
      nroAbonado: r.nroAbonado,
      origen: r.origen,
      creadaEn: r.creadaEn.toISOString(),
      creadaPor: r.creadaPorNombre,
      cerradaEn: r.cerradaEn ? r.cerradaEn.toISOString() : null,
      cierreMotivo: r.cierreMotivo,
      eventos: r.eventos.map((e) => ({ tipo: e.tipo, actor: e.actorNombre, creadoEn: e.creadoEn.toISOString() })),
    }));
  });
}
