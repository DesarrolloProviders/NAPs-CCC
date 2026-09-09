import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Reservas de puertos de NAP. Reemplaza a MySQL cccgo.reservas del legacy (una fila por puerto, sin historial).
 *
 *  - La clave de negocio es `id_nodo` (id del puerto en spi40).
 *  - Una sola reserva ACTIVA por puerto: índice único parcial (resuelve la carrera y el bug del INSERT del legacy).
 *  - Vigente = estado 'activa' AND vence_en >= hoy. El paso a 'vencida' es histórico (cron); la lectura filtra por fecha.
 */
export const reservaEstadoEnum = pgEnum("reserva_estado", ["activa", "vencida", "liberada", "instalada"]);
export const reservaOrigenEnum = pgEnum("reserva_origen", ["app", "legacy_import"]);
export const reservaEventoTipoEnum = pgEnum("reserva_evento_tipo", ["creada", "liberada", "instalada", "vencida", "importada"]);

export const reservas = pgTable(
  "reservas",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    idNodo: integer("id_nodo").notNull(),
    idNapNorm: text("id_nap_norm"),
    idNapOriginal: text("id_nap_original"),
    puerto: smallint("puerto"),
    estado: reservaEstadoEnum("estado").notNull().default("activa"),
    observacion: text("observacion").notNull(),
    venceEn: date("vence_en").notNull(),
    nroAbonado: text("nro_abonado"),
    origen: reservaOrigenEnum("origen").notNull().default("app"),
    creadaPor: text("creada_por").references(() => user.id, { onDelete: "set null" }),
    creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
    cerradaPor: text("cerrada_por").references(() => user.id, { onDelete: "set null" }),
    cerradaEn: timestamp("cerrada_en", { withTimezone: true }),
    cierreMotivo: text("cierre_motivo"),
    legacySnapshot: jsonb("legacy_snapshot"),
  },
  (t) => [
    uniqueIndex("reservas_activa_por_nodo_uq")
      .on(t.idNodo)
      .where(sql`${t.estado} = 'activa'`),
    uniqueIndex("reservas_legacy_import_uq")
      .on(t.origen, t.idNodo, t.venceEn)
      .where(sql`${t.origen} = 'legacy_import'`),
    index("reservas_nap_estado_idx").on(t.idNapNorm, t.estado),
    index("reservas_vence_activa_idx").on(t.venceEn).where(sql`${t.estado} = 'activa'`),
    index("reservas_id_nodo_idx").on(t.idNodo),
    check("reservas_instalada_requiere_abonado", sql`${t.estado} <> 'instalada' OR ${t.nroAbonado} IS NOT NULL`),
    check("reservas_puerto_rango", sql`${t.puerto} IS NULL OR (${t.puerto} BETWEEN 1 AND 64)`),
  ],
);

export const reservaEventos = pgTable(
  "reserva_eventos",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    reservaId: bigint("reserva_id", { mode: "number" })
      .notNull()
      .references(() => reservas.id, { onDelete: "restrict" }),
    tipo: reservaEventoTipoEnum("tipo").notNull(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    datos: jsonb("datos"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reserva_eventos_reserva_idx").on(t.reservaId, t.creadoEn)],
);

export type Reserva = typeof reservas.$inferSelect;
export type NuevaReserva = typeof reservas.$inferInsert;
export type ReservaEvento = typeof reservaEventos.$inferSelect;
export type ReservaEstado = Reserva["estado"];
