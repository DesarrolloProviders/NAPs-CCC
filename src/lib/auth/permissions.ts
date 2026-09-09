import { z } from "zod";

/**
 * Roles y matriz de permisos. Se usa en el servidor (autoridad) y en la UI (solo para ocultar botones).
 * Regla heredada del legacy: ventas reserva; técnica instala y libera; admin todo.
 */
export const ROLES = ["admin", "tecnico", "ventas"] as const;
export const rolSchema = z.enum(ROLES);
export type Rol = z.infer<typeof rolSchema>;

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  tecnico: "Técnico",
  ventas: "Ventas",
};

export const ACCIONES = {
  ver: ["admin", "tecnico", "ventas"],
  reservar: ["admin", "ventas"],
  liberar: ["admin", "tecnico"],
  instalar: ["admin", "tecnico"],
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
