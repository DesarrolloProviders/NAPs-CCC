import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Control de acceso del plugin admin de better-auth con nuestros tres roles.
 * (Compartido entre servidor y cliente: no importar nada de servidor acá.)
 * La autorización de negocio (reservar / liberar / instalar) vive en permissions.ts; esto solo tipa los roles
 * y habilita al admin a gestionar usuarios.
 */
const statements = { ...defaultStatements } as const;

export const ac = createAccessControl(statements);

export const rolesAuth = {
  admin: ac.newRole({ ...adminAc.statements }),
  tecnico: ac.newRole({}),
  ventas: ac.newRole({}),
};
