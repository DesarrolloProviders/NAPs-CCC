// Crea (o actualiza la contraseña de) el admin inicial y el usuario de sistema de importación. Idempotente.
// Mismo formato de hash que better-auth (proveedor "credential").
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { hashPassword } from "better-auth/crypto";

const { APP_DATABASE_URL: url, ADMIN_SEED_EMAIL: email, ADMIN_SEED_PASSWORD: password } = process.env;
if (!url || !email || !password) {
  console.error("Faltan APP_DATABASE_URL, ADMIN_SEED_EMAIL o ADMIN_SEED_PASSWORD");
  process.exit(1);
}
const sql = postgres(url, { max: 1 });

async function upsert({ email, nombre, rol, password, banned }) {
  const ahora = new Date();
  const [existente] = await sql`SELECT id FROM "user" WHERE email = ${email}`;
  let userId = existente?.id;
  if (userId) {
    await sql`UPDATE "user" SET role = ${rol}, name = ${nombre}, banned = ${banned}, "updatedAt" = ${ahora} WHERE id = ${userId}`;
    console.log(`[seed] ${email} ya existía (rol ${rol})`);
  } else {
    userId = randomUUID();
    await sql`INSERT INTO "user" (id, email, name, "emailVerified", role, banned, "banReason", "createdAt", "updatedAt")
              VALUES (${userId}, ${email}, ${nombre}, true, ${rol}, ${banned}, ${banned ? "Cuenta de sistema" : null}, ${ahora}, ${ahora})`;
    console.log(`[seed] ${email} creado (rol ${rol})`);
  }
  if (password) {
    const hash = await hashPassword(password);
    const [cuenta] = await sql`SELECT id FROM account WHERE "userId" = ${userId} AND "providerId" = 'credential'`;
    if (cuenta) await sql`UPDATE account SET password = ${hash}, "updatedAt" = ${ahora} WHERE id = ${cuenta.id}`;
    else
      await sql`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
                VALUES (${randomUUID()}, ${userId}, 'credential', ${userId}, ${hash}, ${ahora}, ${ahora})`;
  }
}

try {
  await upsert({ email, nombre: "Administrador", rol: "admin", password, banned: false });
  await upsert({ email: "importacion@legacy", nombre: "Importación legacy (sistema)", rol: "ventas", password: null, banned: true });
} finally {
  await sql.end({ timeout: 2 });
}
