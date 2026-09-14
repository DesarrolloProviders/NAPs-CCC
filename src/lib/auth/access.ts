import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Control de acceso del plugin admin de better-auth con nuestros dos roles.
 * (Compartido entre servidor y cliente: no importar nada de servidor acá.)
 * La matriz de permisos vive en permissions.ts; esto solo tipa los roles y habilita
 * al admin a gestionar usuarios.
 *
 * El admin recibe SOLO lo que usa la UI (crear, listar, rol, baja/alta, contraseña, sesiones).
 * No se le da `impersonate` ni `delete`: esos endpoints además están apagados en auth.ts (disabledPaths).
 */
const statements = { ...defaultStatements } as const;

export const ac = createAccessControl(statements);

export const rolesAuth = {
  admin: ac.newRole({
    user: ["create", "list", "set-role", "ban", "set-password", "get"],
    session: ["list", "revoke"],
  }),
  usuario: ac.newRole({}),
};
