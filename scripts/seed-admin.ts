/**
 * Crea (o actualiza la contraseña de) el administrador inicial a partir de ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD.
 * También crea el usuario de sistema "importacion@legacy" (deshabilitado, sin login) usado como actor de las importaciones.
 * Idempotente: se puede correr las veces que haga falta.
 *   npm run seed:admin
 */
import "./_env";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, appSql } from "@/db/client";
import { account, user } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { env } from "@/lib/env";

export const EMAIL_SISTEMA_IMPORTACION = "importacion@legacy";

async function upsertUsuario(opts: { email: string; nombre: string; rol: string; password?: string; banned?: boolean }): Promise<string> {
  const ahora = new Date();
  const existente = await db.query.user.findFirst({ where: eq(user.email, opts.email) });
  let userId: string;
  if (existente) {
    userId = existente.id;
    await db
      .update(user)
      .set({ role: opts.rol, name: opts.nombre, banned: opts.banned ?? false, banReason: opts.banned ? "Cuenta de sistema" : null, updatedAt: ahora })
      .where(eq(user.id, userId));
    console.log(`Usuario ${opts.email} ya existía (id ${userId}); rol=${opts.rol}`);
  } else {
    userId = randomUUID();
    await db.insert(user).values({
      id: userId,
      email: opts.email,
      name: opts.nombre,
      emailVerified: true,
      role: opts.rol,
      banned: opts.banned ?? false,
      banReason: opts.banned ? "Cuenta de sistema" : null,
      createdAt: ahora,
      updatedAt: ahora,
    });
    console.log(`Usuario ${opts.email} creado (id ${userId}); rol=${opts.rol}`);
  }

  if (opts.password) {
    // Mismo hash que usa better-auth para el proveedor "credential".
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(opts.password);
    const cuenta = await db.query.account.findFirst({ where: eq(account.userId, userId) });
    if (cuenta) {
      await db.update(account).set({ password: hash, updatedAt: ahora }).where(eq(account.id, cuenta.id));
      console.log("  contraseña actualizada");
    } else {
      await db.insert(account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hash,
        createdAt: ahora,
        updatedAt: ahora,
      });
      console.log("  cuenta de credenciales creada");
    }
  }
  return userId;
}

async function main() {
  await upsertUsuario({ email: env.ADMIN_SEED_EMAIL, nombre: "Administrador", rol: "admin", password: env.ADMIN_SEED_PASSWORD });
  await upsertUsuario({ email: EMAIL_SISTEMA_IMPORTACION, nombre: "Importación legacy (sistema)", rol: "ventas", banned: true });
  await appSql.end({ timeout: 2 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
