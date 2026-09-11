ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'usuario';--> statement-breakpoint
-- La app pasó a ser de solo consulta: los roles tecnico/ventas se unifican en 'usuario'.
UPDATE "user" SET "role" = 'usuario' WHERE "role" NOT IN ('admin', 'usuario');
