// Crea (o actualiza la contraseña de) el admin inicial y el usuario de sistema de importación. Idempotente.
// Hash de contraseña compatible con better-auth (proveedor "credential"): scrypt N=16384 r=16 p=1 dkLen=64, "salt:hex".
// Se usa node:crypto directamente para no depender de better-auth dentro del standalone.
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import postgres from "postgres";

const { APP_DATABASE_URL: url, ADMIN_SEED_EMAIL: email, ADMIN_SEED_PASSWORD: password } = process.env;
if (!url || !email || !password) {
  console.error("Faltan APP_DATABASE_URL, ADMIN_SEED_EMAIL o ADMIN_SEED_PASSWORD");
  process.exit(1);
}

const SCRYPT = { N: 16384, r: 16, p: 1, dkLen: 64 };
function hashPassword(plano) {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    scrypt(plano.normalize("NFKC"), salt, SCRYPT.dkLen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2 }, (err, key) => {
      if (err) reject(err);
      else resolve(`${salt}:${key.toString("hex")}`);
    });
  });
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
