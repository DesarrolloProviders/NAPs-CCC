/**
 * Aplica las migraciones SQL de ./drizzle a APP_DATABASE_URL.
 *   npm run db:migrate            (usa .env.local)
 *   Docker: lo ejecuta docker/entrypoint.sh antes de arrancar.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { db, appSql } = await import("@/db/client");
  console.log("Aplicando migraciones...");
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migraciones aplicadas.");
  await appSql.end({ timeout: 2 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
