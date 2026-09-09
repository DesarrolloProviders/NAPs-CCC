import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, type Session } from "@/lib/auth/auth";
import { PermisoDenegadoError, puede, type Accion, type Rol } from "@/lib/auth/permissions";

export interface Actor {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

/** Sesión actual (cacheada por request). null si no hay sesión válida. */
export const getSession = cache(async (): Promise<Session | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  return s ?? null;
});

export function actorDe(session: Session): Actor {
  const rol = (session.user.role ?? "ventas") as Rol;
  return { id: session.user.id, nombre: session.user.name, email: session.user.email, rol };
}

/** Para páginas: redirige a /login si no hay sesión. */
export async function getActorOrRedirect(): Promise<Actor> {
  const s = await getSession();
  if (!s) redirect("/login");
  return actorDe(s);
}

/** Para Server Actions y route handlers: lanza si no hay sesión o el rol no puede ejecutar la acción. */
export async function requireRole(accion: Accion): Promise<Actor> {
  const s = await getSession();
  if (!s) throw new PermisoDenegadoError(accion, null);
  const actor = actorDe(s);
  if (!puede(actor.rol, accion)) throw new PermisoDenegadoError(accion, actor.rol);
  return actor;
}
