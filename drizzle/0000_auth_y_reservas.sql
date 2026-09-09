CREATE TYPE "public"."reserva_estado" AS ENUM('activa', 'vencida', 'liberada', 'instalada');--> statement-breakpoint
CREATE TYPE "public"."reserva_evento_tipo" AS ENUM('creada', 'liberada', 'instalada', 'vencida', 'importada');--> statement-breakpoint
CREATE TYPE "public"."reserva_origen" AS ENUM('app', 'legacy_import');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"impersonatedBy" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text DEFAULT 'ventas' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"banReason" text,
	"banExpires" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reserva_eventos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"reserva_id" bigint NOT NULL,
	"tipo" "reserva_evento_tipo" NOT NULL,
	"actor_id" text,
	"datos" jsonb,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"id_nodo" integer NOT NULL,
	"id_nap_norm" text,
	"id_nap_original" text,
	"puerto" smallint,
	"estado" "reserva_estado" DEFAULT 'activa' NOT NULL,
	"observacion" text NOT NULL,
	"vence_en" date NOT NULL,
	"nro_abonado" text,
	"origen" "reserva_origen" DEFAULT 'app' NOT NULL,
	"creada_por" text,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrada_por" text,
	"cerrada_en" timestamp with time zone,
	"cierre_motivo" text,
	"legacy_snapshot" jsonb,
	CONSTRAINT "reservas_instalada_requiere_abonado" CHECK ("reservas"."estado" <> 'instalada' OR "reservas"."nro_abonado" IS NOT NULL),
	CONSTRAINT "reservas_puerto_rango" CHECK ("reservas"."puerto" IS NULL OR ("reservas"."puerto" BETWEEN 1 AND 64))
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_eventos" ADD CONSTRAINT "reserva_eventos_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserva_eventos" ADD CONSTRAINT "reserva_eventos_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_creada_por_user_id_fk" FOREIGN KEY ("creada_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cerrada_por_user_id_fk" FOREIGN KEY ("cerrada_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "reserva_eventos_reserva_idx" ON "reserva_eventos" USING btree ("reserva_id","creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "reservas_activa_por_nodo_uq" ON "reservas" USING btree ("id_nodo") WHERE "reservas"."estado" = 'activa';--> statement-breakpoint
CREATE UNIQUE INDEX "reservas_legacy_import_uq" ON "reservas" USING btree ("origen","id_nodo","vence_en") WHERE "reservas"."origen" = 'legacy_import';--> statement-breakpoint
CREATE INDEX "reservas_nap_estado_idx" ON "reservas" USING btree ("id_nap_norm","estado");--> statement-breakpoint
CREATE INDEX "reservas_vence_activa_idx" ON "reservas" USING btree ("vence_en") WHERE "reservas"."estado" = 'activa';--> statement-breakpoint
CREATE INDEX "reservas_id_nodo_idx" ON "reservas" USING btree ("id_nodo");