"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { PermisoDenegadoError } from "@/lib/auth/permissions";
import { requireRole } from "@/lib/auth/session";
import { loggerDe } from "@/lib/logger";
import {
  activarUsuarioSchema,
  cambiarRolSchema,
  crearUsuarioSchema,
  resetearPasswordSchema,
  type ResultadoAccion,
  type UsuarioVista,
} from "@/features/usuarios/schemas";

const log = loggerDe("usuarios");

/** Usuarios del sistema (excluye la cuenta de sistema de importación). */
export async function listarUsuarios(): Promise<UsuarioVista[]> {
  await requireRole("usuarios");
  const filas = await db.query.user.findMany({ orderBy: (u, { asc }) => [asc(u.name)] });
  return filas
    .filter((u) => u.email !== "importacion@legacy")
    .map((u) => ({ id: u.id, nombre: u.name, email: u.email, rol: u.role, activo: !u.banned, creadoEn: u.createdAt.toISOString() }));
}

function manejar(e: unknown, contexto: string): ResultadoAccion<never> {
  if (e instanceof PermisoDenegadoError) return { ok: false, error: "No tenés permiso para esta acción." };
  const mensaje = e instanceof Error ? e.message : String(e);
  log.error({ contexto, error: mensaje }, "acción de usuarios falló");
  if (/already exists|ya existe|unique/i.test(mensaje)) return { ok: false, error: "Ya existe un usuario con ese email." };
  return { ok: false, error: mensaje || "Error inesperado." };
}

export async function crearUsuario(input: unknown): Promise<ResultadoAccion<{ id: string }>> {
  try {
    const actor = await requireRole("usuarios");
    const datos = crearUsuarioSchema.parse(input);
    const creado = await auth.api.createUser({
      headers: await headers(),
      body: { email: datos.email, password: datos.password, name: datos.nombre, role: datos.rol },
    });
    log.info({ actor: actor.email, nuevo: datos.email, rol: datos.rol }, "usuario creado");
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
    log.info({ actor: actor.email, userId, rol }, "rol cambiado");
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
      await auth.api.banUser({ headers: await headers(), body: { userId, banReason: `Desactivado por ${actor.email}` } });
    }
    log.info({ actor: actor.email, userId, activo }, "usuario activado/desactivado");
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
    log.info({ actor: actor.email, userId }, "contraseña reseteada");
    return { ok: true };
  } catch (e) {
    return manejar(e, "resetearPassword");
  }
}

/** Solo para verificación: nombre de un usuario por id (usado en historiales). */
export async function nombreDeUsuario(id: string): Promise<string | null> {
  const u = await db.query.user.findFirst({ where: eq(user.id, id), columns: { name: true } });
  return u?.name ?? null;
}
