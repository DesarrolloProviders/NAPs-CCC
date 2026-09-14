"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db/client";
import { auth } from "@/lib/auth/auth";
import { PermisoDenegadoError } from "@/lib/auth/permissions";
import { requireRole } from "@/lib/auth/session";
import { registrarAuditoria } from "@/lib/auditoria";
import { loggerDe } from "@/lib/logger";
import {
  activarUsuarioSchema,
  cambiarRolSchema,
  crearUsuarioSchema,
  resetearPasswordSchema,
  type ResultadoAccion,
  type UsuarioVista,
} from "@/features/usuarios/schemas";

/*
 * Todas las funciones exportadas de este archivo son endpoints HTTP (Server Actions):
 * la primera línea de cada una debe ser `requireRole(...)`.
 */

const log = loggerDe("usuarios");

/** Usuarios del sistema (excluye la cuenta de sistema de importación). */
export async function listarUsuarios(): Promise<UsuarioVista[]> {
  await requireRole("usuarios");
  const filas = await db.query.user.findMany({ orderBy: (u, { asc }) => [asc(u.name)] });
  return filas
    .filter((u) => u.email !== "importacion@legacy")
    .map((u) => ({ id: u.id, nombre: u.name, email: u.email, rol: u.role, activo: !u.banned, creadoEn: u.createdAt.toISOString() }));
}

/** Traduce errores a mensajes seguros para la UI; el detalle va solo al log. */
function manejar(e: unknown, contexto: string): ResultadoAccion<never> {
  if (e instanceof PermisoDenegadoError) return { ok: false, error: "No tenés permiso para esta acción." };
  if (e instanceof ZodError) return { ok: false, error: "Los datos ingresados no son válidos." };
  const mensaje = e instanceof Error ? e.message : String(e);
  log.error({ contexto, err: e }, "acción de usuarios falló");
  if (/already exists|ya existe|unique/i.test(mensaje)) return { ok: false, error: "Ya existe un usuario con ese email." };
  return { ok: false, error: "Error inesperado. Si persiste, avisá a sistemas." };
}

/** Cierra todas las sesiones abiertas de otro usuario (tras cambiar su rol o su contraseña). */
async function revocarSesionesDe(userId: string) {
  await auth.api.revokeUserSessions({ headers: await headers(), body: { userId } });
}

export async function crearUsuario(input: unknown): Promise<ResultadoAccion<{ id: string }>> {
  try {
    const actor = await requireRole("usuarios");
    const datos = crearUsuarioSchema.parse(input);
    const creado = await auth.api.createUser({
      headers: await headers(),
      body: { email: datos.email, password: datos.password, name: datos.nombre, role: datos.rol },
    });
    log.info({ actorId: actor.id, userId: creado.user.id, rol: datos.rol }, "usuario creado");
    await registrarAuditoria({ actorId: actor.id, accion: "usuario.crear", objetivoId: creado.user.id, datos: { email: datos.email, rol: datos.rol } });
    revalidatePath("/admin/usuarios");
    return { ok: true, data: { id: creado.user.id } };
  } catch (e) {
    return manejar(e, "crearUsuario");
  }
}

export async function cambiarRol(input: unknown): Promise<ResultadoAccion> {
  try {
    const actor = await requireRole("usuarios");
    const { userId, rol } = cambiarRolSchema.parse(input);
    if (userId === actor.id && rol !== "admin") return { ok: false, error: "No podés quitarte el rol de administrador a vos mismo." };
    await auth.api.setRole({ headers: await headers(), body: { userId, role: rol } });
    // El rol viaja en la cookie de sesión: sin esto el cambio tardaría hasta AUTH_COOKIE_CACHE_S en verse.
    if (userId !== actor.id) await revocarSesionesDe(userId);
    log.info({ actorId: actor.id, userId, rol }, "rol cambiado");
    await registrarAuditoria({ actorId: actor.id, accion: "usuario.rol", objetivoId: userId, datos: { rol } });
    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e) {
    return manejar(e, "cambiarRol");
  }
}

export async function activarUsuario(input: unknown): Promise<ResultadoAccion> {
  try {
    const actor = await requireRole("usuarios");
    const { userId, activo } = activarUsuarioSchema.parse(input);
    if (userId === actor.id && !activo) return { ok: false, error: "No podés desactivar tu propio usuario." };
    if (activo) {
      await auth.api.unbanUser({ headers: await headers(), body: { userId } });
    } else {
      // banUser ya borra las sesiones del usuario.
      await auth.api.banUser({ headers: await headers(), body: { userId, banReason: `Desactivado por ${actor.email}` } });
    }
    log.info({ actorId: actor.id, userId, activo }, "usuario activado/desactivado");
    await registrarAuditoria({ actorId: actor.id, accion: activo ? "usuario.activar" : "usuario.desactivar", objetivoId: userId });
    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e) {
    return manejar(e, "activarUsuario");
  }
}

export async function resetearPassword(input: unknown): Promise<ResultadoAccion> {
  try {
    const actor = await requireRole("usuarios");
    const { userId, password } = resetearPasswordSchema.parse(input);
    await auth.api.setUserPassword({ headers: await headers(), body: { userId, newPassword: password } });
    // Si la cuenta estaba comprometida, quien la usaba no debe seguir adentro.
    if (userId !== actor.id) await revocarSesionesDe(userId);
    log.info({ actorId: actor.id, userId }, "contraseña reseteada");
    await registrarAuditoria({ actorId: actor.id, accion: "usuario.reset_password", objetivoId: userId });
    return { ok: true };
  } catch (e) {
    return manejar(e, "resetearPassword");
  }
}
