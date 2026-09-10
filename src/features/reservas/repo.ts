import "server-only";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { reservaEventos, reservas, user, type NuevaReserva, type Reserva } from "@/db/schema";
import { aFechaIso, hoy } from "@/lib/fechas";

/**
 * Acceso a datos de reservas. Sin reglas de negocio (esas viven en service.ts).
 * Vigente = estado 'activa' AND vence_en >= hoy (la lectura no depende del cron de vencimiento).
 */

export interface ReservaVigente {
  id: number;
  idNodo: number;
  idNapNorm: string | null;
  puerto: number | null;
  observacion: string;
  venceEn: string;
  creadaEn: Date;
  creadaPor: { id: string; nombre: string } | null;
}

export interface ReservaConUsuarios extends Reserva {
  creadaPorNombre: string | null;
  cerradaPorNombre: string | null;
}

function aVigente(r: Reserva & { creadaPorNombre: string | null }): ReservaVigente {
  return {
    id: r.id,
    idNodo: r.idNodo,
    idNapNorm: r.idNapNorm,
    puerto: r.puerto,
    observacion: r.observacion,
    venceEn: r.venceEn,
    creadaEn: r.creadaEn,
    creadaPor: r.creadaPor ? { id: r.creadaPor, nombre: r.creadaPorNombre ?? "—" } : null,
  };
}

/** Reservas vigentes para un conjunto de puertos (id_nodo de spi40). */
export async function reservasVigentesPorIdNodos(idNodos: number[]): Promise<Map<number, ReservaVigente>> {
  const mapa = new Map<number, ReservaVigente>();
  if (idNodos.length === 0) return mapa;
  const filas = await db
    .select({ r: reservas, creadaPorNombre: user.name })
    .from(reservas)
    .leftJoin(user, eq(user.id, reservas.creadaPor))
    .where(and(inArray(reservas.idNodo, idNodos), eq(reservas.estado, "activa"), gte(reservas.venceEn, aFechaIso(hoy()))));
  for (const f of filas) mapa.set(f.r.idNodo, aVigente({ ...f.r, creadaPorNombre: f.creadaPorNombre }));
  return mapa;
}

/** Reservas 'instalada' recientes (últimos N días) por puerto: el puerto puede tardar en aparecer con MAC en spi40. */
export async function instaladasRecientesPorIdNodos(idNodos: number[], dias = 30): Promise<Set<number>> {
  const set = new Set<number>();
  if (idNodos.length === 0) return set;
  const filas = await db
    .select({ idNodo: reservas.idNodo })
    .from(reservas)
    .where(
      and(
        inArray(reservas.idNodo, idNodos),
        eq(reservas.estado, "instalada"),
        gte(reservas.cerradaEn, sql`now() - make_interval(days => ${dias})`),
      ),
    );
  for (const f of filas) set.add(f.idNodo);
  return set;
}

export async function reservaPorId(id: number, tx?: Tx): Promise<Reserva | null> {
  const ejecutor = tx ?? db;
  const fila = await ejecutor.query.reservas.findFirst({ where: eq(reservas.id, id) });
  return fila ?? null;
}

/** Reserva activa (vigente o no) de un puerto, con bloqueo de fila si se pasa una transacción. */
export async function reservaActivaPorIdNodo(idNodo: number, tx?: Tx): Promise<Reserva | null> {
  const condicion = and(eq(reservas.idNodo, idNodo), eq(reservas.estado, "activa"));
  const filas = tx
    ? await tx.select().from(reservas).where(condicion).limit(1).for("update")
    : await db.select().from(reservas).where(condicion).limit(1);
  return filas[0] ?? null;
}

export async function insertarReserva(datos: NuevaReserva, tx?: Tx): Promise<Reserva> {
  const ejecutor = tx ?? db;
  const [fila] = await ejecutor.insert(reservas).values(datos).returning();
  return fila!;
}

export async function actualizarReserva(id: number, cambios: Partial<NuevaReserva>, tx?: Tx): Promise<Reserva> {
  const ejecutor = tx ?? db;
  const [fila] = await ejecutor.update(reservas).set(cambios).where(eq(reservas.id, id)).returning();
  return fila!;
}

export async function registrarEvento(
  datos: { reservaId: number; tipo: "creada" | "liberada" | "instalada" | "vencida" | "importada"; actorId: string | null; datos?: Record<string, unknown> },
  tx?: Tx,
): Promise<void> {
  const ejecutor = tx ?? db;
  await ejecutor.insert(reservaEventos).values({ reservaId: datos.reservaId, tipo: datos.tipo, actorId: datos.actorId, datos: datos.datos ?? null });
}

/** Historial completo de un puerto (todas sus reservas con eventos), más reciente primero. */
export async function historialPorIdNodo(idNodo: number, limite = 20) {
  const filas = await db
    .select({ r: reservas, creadaPorNombre: user.name })
    .from(reservas)
    .leftJoin(user, eq(user.id, reservas.creadaPor))
    .where(eq(reservas.idNodo, idNodo))
    .orderBy(desc(reservas.creadaEn))
    .limit(limite);
  const ids = filas.map((f) => f.r.id);
  const eventos = ids.length
    ? await db
        .select({ e: reservaEventos, actorNombre: user.name })
        .from(reservaEventos)
        .leftJoin(user, eq(user.id, reservaEventos.actorId))
        .where(inArray(reservaEventos.reservaId, ids))
        .orderBy(desc(reservaEventos.creadoEn))
    : [];
  return filas.map((f) => ({
    ...f.r,
    creadaPorNombre: f.creadaPorNombre,
    eventos: eventos.filter((e) => e.e.reservaId === f.r.id).map((e) => ({ ...e.e, actorNombre: e.actorNombre })),
  }));
}

/** Marca como vencidas las activas cuya fecha ya pasó. Devuelve la cantidad. */
export async function vencerReservas(actorId: string | null): Promise<number> {
  return db.transaction(async (tx) => {
    const vencidas = await tx
      .update(reservas)
      .set({ estado: "vencida", cerradaEn: new Date(), cierreMotivo: "Vencimiento automático" })
      .where(and(eq(reservas.estado, "activa"), lt(reservas.venceEn, aFechaIso(hoy()))))
      .returning({ id: reservas.id });
    if (vencidas.length) {
      await tx.insert(reservaEventos).values(vencidas.map((v) => ({ reservaId: v.id, tipo: "vencida" as const, actorId, datos: null })));
    }
    return vencidas.length;
  });
}
