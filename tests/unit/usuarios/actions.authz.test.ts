import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermisoDenegadoError } from "@/lib/auth/permissions";

/**
 * Las Server Actions de usuarios son endpoints HTTP: cada una debe rechazar sin sesión o sin rol admin,
 * y nunca devolver detalles internos al navegador.
 */
const requireRole = vi.fn();
const api = {
  createUser: vi.fn(),
  setRole: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  setUserPassword: vi.fn(),
  revokeUserSessions: vi.fn(),
};
const insertValues = vi.fn(async () => undefined);

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/auth/session", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@/lib/auth/auth", () => ({ auth: { api } }));
vi.mock("@/db/client", () => ({
  db: {
    insert: () => ({ values: insertValues }),
    query: { user: { findMany: vi.fn(async () => []) } },
  },
}));
vi.mock("@/lib/logger", () => ({ loggerDe: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }) }));

const ADMIN = { id: "admin-1", nombre: "Admin", email: "admin@ccc.local", rol: "admin" as const };

describe("acciones de usuarios: autorización y mensajes", () => {
  beforeEach(() => {
    requireRole.mockReset();
    Object.values(api).forEach((m) => m.mockReset());
    insertValues.mockClear();
  });

  it("sin sesión o sin rol admin, todas las acciones devuelven 'sin permiso' y no tocan better-auth", async () => {
    requireRole.mockRejectedValue(new PermisoDenegadoError("usuarios", "usuario"));
    const { crearUsuario, cambiarRol, activarUsuario, resetearPassword, listarUsuarios } = await import("@/features/usuarios/actions");

    const resultados = await Promise.all([
      crearUsuario({ email: "x@x.com", password: "0123456789", nombre: "X", rol: "usuario" }),
      cambiarRol({ userId: "u1", rol: "admin" }),
      activarUsuario({ userId: "u1", activo: false }),
      resetearPassword({ userId: "u1", password: "0123456789" }),
    ]);
    for (const r of resultados) expect(r).toEqual({ ok: false, error: "No tenés permiso para esta acción." });
    await expect(listarUsuarios()).rejects.toBeInstanceOf(PermisoDenegadoError);
    expect(api.createUser).not.toHaveBeenCalled();
    expect(api.setRole).not.toHaveBeenCalled();
    expect(api.banUser).not.toHaveBeenCalled();
    expect(api.setUserPassword).not.toHaveBeenCalled();
  });

  it("un error interno no llega al navegador con su mensaje crudo", async () => {
    requireRole.mockResolvedValue(ADMIN);
    api.createUser.mockRejectedValue(new Error('password authentication failed for user "naps"'));
    const { crearUsuario } = await import("@/features/usuarios/actions");
    const r = await crearUsuario({ email: "x@x.com", password: "0123456789", nombre: "X", rol: "usuario" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toContain("naps");
      expect(r.error).not.toContain("authentication");
    }
  });

  it("datos inválidos devuelven un mensaje genérico de validación", async () => {
    requireRole.mockResolvedValue(ADMIN);
    const { cambiarRol } = await import("@/features/usuarios/actions");
    expect(await cambiarRol({ userId: "u1", rol: "superadmin" })).toEqual({ ok: false, error: "Los datos ingresados no son válidos." });
  });

  it("cambiar el rol o resetear la contraseña de OTRO usuario cierra sus sesiones y queda auditado", async () => {
    requireRole.mockResolvedValue(ADMIN);
    api.setRole.mockResolvedValue({});
    api.setUserPassword.mockResolvedValue({});
    api.revokeUserSessions.mockResolvedValue({});
    const { cambiarRol, resetearPassword } = await import("@/features/usuarios/actions");

    expect(await cambiarRol({ userId: "u2", rol: "usuario" })).toEqual({ ok: true });
    expect(await resetearPassword({ userId: "u2", password: "0123456789" })).toEqual({ ok: true });
    expect(api.revokeUserSessions).toHaveBeenCalledTimes(2);
    expect(api.revokeUserSessions).toHaveBeenCalledWith(expect.objectContaining({ body: { userId: "u2" } }));
    expect(insertValues).toHaveBeenCalledTimes(2);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ accion: "usuario.rol", objetivoId: "u2" }));
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ accion: "usuario.reset_password", objetivoId: "u2" }));
  });

  it("no se revocan las sesiones propias al cambiarse la contraseña a uno mismo", async () => {
    requireRole.mockResolvedValue(ADMIN);
    api.setUserPassword.mockResolvedValue({});
    const { resetearPassword } = await import("@/features/usuarios/actions");
    expect(await resetearPassword({ userId: ADMIN.id, password: "0123456789" })).toEqual({ ok: true });
    expect(api.revokeUserSessions).not.toHaveBeenCalled();
  });

  it("guardas: un admin no puede degradarse ni desactivarse a sí mismo", async () => {
    requireRole.mockResolvedValue(ADMIN);
    const { cambiarRol, activarUsuario } = await import("@/features/usuarios/actions");
    expect((await cambiarRol({ userId: ADMIN.id, rol: "usuario" })).ok).toBe(false);
    expect((await activarUsuario({ userId: ADMIN.id, activo: false })).ok).toBe(false);
    expect(api.setRole).not.toHaveBeenCalled();
    expect(api.banUser).not.toHaveBeenCalled();
  });
});
