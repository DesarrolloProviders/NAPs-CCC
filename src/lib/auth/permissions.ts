import { z } from "zod";

/**
 * Roles y matriz de permisos. Se usa en el servidor (autoridad) y en la UI (solo para ocultar botones).
 * La app es de solo consulta: todos ven las NAPs y sus puertos; el admin además gestiona usuarios.
 */
export const ROLES = ["admin", "usuario"] as const;
export const rolSchema = z.enum(ROLES);
export type Rol = z.infer<typeof rolSchema>;

export const ROL_DEFAULT: Rol = "usuario";

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  usuario: "Usuario",
};

export const ACCIONES = {
  ver: ["admin", "usuario"],
  usuarios: ["admin"],
} as const satisfies Record<string, readonly Rol[]>;

export type Accion = keyof typeof ACCIONES;

export function puede(rol: string | null | undefined, accion: Accion): boolean {
  if (!rol) return false;
  return (ACCIONES[accion] as readonly string[]).includes(rol);
}

export function esRol(valor: unknown): valor is Rol {
  return rolSchema.safeParse(valor).success;
}

/** Error de autorización para lanzar desde acciones del servidor. */
export class PermisoDenegadoError extends Error {
  constructor(readonly accion: Accion, readonly rol: string | null | undefined) {
    super(`El rol "${rol ?? "sin rol"}" no puede ${accion}`);
    this.name = "PermisoDenegadoError";
  }
}
