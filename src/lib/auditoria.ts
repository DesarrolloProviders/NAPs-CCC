import "server-only";
import { db } from "@/db/client";
import { auditoria } from "@/db/schema";
import { loggerDe } from "@/lib/logger";

const log = loggerDe("usuarios");

export type AccionAuditada = "usuario.crear" | "usuario.rol" | "usuario.activar" | "usuario.desactivar" | "usuario.reset_password";

/**
 * Deja constancia persistente de una acción de administración.
 * Nunca lanza: una falla al auditar se loguea, pero no deshace la acción ya hecha.
 */
export async function registrarAuditoria(entrada: { actorId: string; accion: AccionAuditada; objetivoId?: string | null; datos?: Record<string, unknown> }) {
  try {
    await db.insert(auditoria).values({
      actorId: entrada.actorId,
      accion: entrada.accion,
      objetivoId: entrada.objetivoId ?? null,
      datos: entrada.datos ?? null,
    });
  } catch (e) {
    log.error({ err: e, accion: entrada.accion }, "no se pudo registrar la auditoría");
  }
}
