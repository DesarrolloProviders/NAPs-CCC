CREATE TABLE "auditoria" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"accion" text NOT NULL,
	"objetivo_id" text,
	"datos" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_objetivo_id_user_id_fk" FOREIGN KEY ("objetivo_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_creado_en_idx" ON "auditoria" USING btree ("creado_en");--> statement-breakpoint
CREATE INDEX "auditoria_objetivo_idx" ON "auditoria" USING btree ("objetivo_id");