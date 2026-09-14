import { bigserial, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Registro persistente de las acciones de administración (crear usuario, cambiar rol, dar de baja, resetear
 * contraseña). Los logs de stdout rotan; esto queda. Solo escribe la app; no se edita ni se borra desde la UI.
 */
export const auditoria = pgTable(
  "auditoria",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** Quién hizo la acción (id de `user`). Se conserva aunque el usuario se borre. */
    actorId: text("actor_id").notNull(),
    accion: text("accion").notNull(),
    /** Sobre quién (id de `user`), si aplica. */
    objetivoId: text("objetivo_id").references(() => user.id, { onDelete: "set null" }),
    datos: jsonb("datos").$type<Record<string, unknown>>(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auditoria_creado_en_idx").on(t.creadoEn), index("auditoria_objetivo_idx").on(t.objetivoId)],
);
