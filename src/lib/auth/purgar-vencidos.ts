import "server-only";
import { lt } from "drizzle-orm";
import { db } from "@/db/client";
import { session, verification } from "@/db/schema";
import { loggerDe } from "@/lib/logger";

const log = loggerDe("auth");

/** Borra sesiones y verificaciones vencidas. Devuelve cuántas filas se fueron. */
export async function purgarVencidos(ahora = new Date()): Promise<{ sesiones: number; verificaciones: number }> {
  const sesiones = await db.delete(session).where(lt(session.expiresAt, ahora)).returning({ id: session.id });
  const verificaciones = await db.delete(verification).where(lt(verification.expiresAt, ahora)).returning({ id: verification.id });
  const resultado = { sesiones: sesiones.length, verificaciones: verificaciones.length };
  if (resultado.sesiones || resultado.verificaciones) log.info(resultado, "purga de vencidos");
  return resultado;
}
