// Crea el admin inicial si no existe. Se corre en cada arranque del contenedor (ver entrypoint.sh).
// Si el usuario YA existe no toca nada (ni rol, ni estado, ni contraseña): lo que el admin cambió por la UI se conserva.
// Para forzar un reset de contraseña/rol una sola vez: ADMIN_SEED_FORCE=1.
// Hash de contraseña compatible con better-auth (proveedor "credential"): scrypt N=16384 r=16 p=1 dkLen=64, "salt:hex".
// Se usa node:crypto directamente para no depender de better-auth dentro del standalone.
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import postgres from "postgres";

const { APP_DATABASE_URL: url, ADMIN_SEED_EMAIL: email, ADMIN_SEED_PASSWORD: password } = process.env;
const forzar = process.env.ADMIN_SEED_FORCE === "1";
if (!url || !email || !password) {
  console.error("Faltan APP_DATABASE_URL, ADMIN_SEED_EMAIL o ADMIN_SEED_PASSWORD");
  process.exit(1);
}
if (password.length < 4) {
  console.error("ADMIN_SEED_PASSWORD debe tener al menos 4 caracteres");
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

async function asegurarAdmin() {
  const ahora = new Date();
  const [existente] = await sql`SELECT id FROM "user" WHERE email = ${email}`;
  if (existente && !forzar) {
    console.log(`[seed] ${email} ya existe: sin cambios (ADMIN_SEED_FORCE=1 para resetear rol y contraseña)`);
    return;
  }

  let userId = existente?.id;
  if (userId) {
    await sql`UPDATE "user" SET role = 'admin', banned = false, "banReason" = NULL, "updatedAt" = ${ahora} WHERE id = ${userId}`;
    console.log(`[seed] ${email} restablecido como admin activo (ADMIN_SEED_FORCE=1)`);
  } else {
    userId = randomUUID();
    await sql`INSERT INTO "user" (id, email, name, "emailVerified", role, banned, "banReason", "createdAt", "updatedAt")
              VALUES (${userId}, ${email}, 'Administrador', true, 'admin', false, NULL, ${ahora}, ${ahora})`;
    console.log(`[seed] ${email} creado (rol admin)`);
  }

  const hash = await hashPassword(password);
  const [cuenta] = await sql`SELECT id FROM account WHERE "userId" = ${userId} AND "providerId" = 'credential'`;
  if (cuenta) {
    await sql`UPDATE account SET password = ${hash}, "updatedAt" = ${ahora} WHERE id = ${cuenta.id}`;
    // Un reset forzado cierra las sesiones abiertas de esa cuenta.
    await sql`DELETE FROM session WHERE "userId" = ${userId}`;
  } else {
    await sql`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
              VALUES (${randomUUID()}, ${userId}, 'credential', ${userId}, ${hash}, ${ahora}, ${ahora})`;
  }
}

try {
  await asegurarAdmin();
} finally {
  await sql.end({ timeout: 2 });
}
