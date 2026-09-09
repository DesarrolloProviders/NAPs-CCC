import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

// Solo la base propia (usuarios, reservas, auditoría). El PostGIS de NAPs nunca se migra.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.APP_DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
