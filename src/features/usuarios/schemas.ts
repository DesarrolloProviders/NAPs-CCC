import { z } from "zod";
import { rolSchema } from "@/lib/auth/permissions";

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresá el nombre").max(100),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(10, "Mínimo 10 caracteres").max(128),
  rol: rolSchema,
});
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export const cambiarRolSchema = z.object({ userId: z.string().min(1), rol: rolSchema });
export const activarUsuarioSchema = z.object({ userId: z.string().min(1), activo: z.boolean() });
export const resetearPasswordSchema = z.object({ userId: z.string().min(1), password: z.string().min(10, "Mínimo 10 caracteres").max(128) });

export interface UsuarioVista {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  creadoEn: string;
}

export type ResultadoAccion<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
