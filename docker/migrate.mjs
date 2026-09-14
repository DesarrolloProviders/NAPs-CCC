// Aplica ./drizzle a APP_DATABASE_URL usando los módulos del standalone (sin tsx ni código TypeScript).
// Reintenta si la base todavía no acepta conexiones (arranque en paralelo, reinicio de app-db).
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.APP_DATABASE_URL;
if (!url) {
  console.error("Falta APP_DATABASE_URL");
  process.exit(1);
}

const INTENTOS = 6;
const CODIGOS_TRANSITORIOS = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "57P03", "CONNECT_TIMEOUT"]);

for (let intento = 1; intento <= INTENTOS; intento++) {
  const sql = postgres(url, { max: 1, connect_timeout: 10 });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    console.log("[migrate] migraciones aplicadas");
    await sql.end({ timeout: 2 });
    process.exit(0);
  } catch (e) {
    await sql.end({ timeout: 2 }).catch(() => undefined);
    const codigo = e?.code ?? e?.cause?.code;
    const transitorio = CODIGOS_TRANSITORIOS.has(codigo);
    if (!transitorio || intento === INTENTOS) {
      console.error(`[migrate] falló (${codigo ?? e?.name ?? "error"}): ${e?.message ?? e}`);
      process.exit(1);
    }
    const espera = 2000 * intento;
    console.log(`[migrate] base no disponible (${codigo}); reintento ${intento}/${INTENTOS - 1} en ${espera} ms`);
    await new Promise((r) => setTimeout(r, espera));
  }
}
