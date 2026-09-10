// Aplica ./drizzle a APP_DATABASE_URL usando los módulos del standalone (sin tsx ni código TypeScript).
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.APP_DATABASE_URL;
if (!url) {
  console.error("Falta APP_DATABASE_URL");
  process.exit(1);
}
const sql = postgres(url, { max: 1 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  console.log("[migrate] migraciones aplicadas");
} finally {
  await sql.end({ timeout: 2 });
}
