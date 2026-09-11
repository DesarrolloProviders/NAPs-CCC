import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Control de acceso del plugin admin de better-auth con nuestros dos roles.
 * (Compartido entre servidor y cliente: no importar nada de servidor acá.)
 * La matriz de permisos vive en permissions.ts; esto solo tipa los roles y habilita
 * al admin a gestionar usuarios.
 */
const statements = { ...defaultStatements } as const;

export const ac = createAccessControl(statements);

export const rolesAuth = {
  admin: ac.newRole({ ...adminAc.statements }),
  usuario: ac.newRole({}),
};
