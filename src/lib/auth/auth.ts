import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { ac, rolesAuth } from "@/lib/auth/access";
import { env } from "@/lib/env";

/**
 * better-auth: email + contraseña, sesiones en la base propia, roles vía plugin admin.
 * El registro público está deshabilitado: solo un admin crea usuarios.
 */
export const auth = betterAuth({
  appName: "NAPs CCC",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 días
    updateAge: 60 * 60 * 24, // renueva una vez por día
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: {
    cookiePrefix: "naps",
    useSecureCookies: env.NODE_ENV === "production",
  },
  // Igual que el default de better-auth: solo en producción (en dev y e2e hay muchos logins seguidos).
  rateLimit: { enabled: env.NODE_ENV === "production", window: 60, max: 30 },
  plugins: [admin({ ac, roles: rolesAuth, defaultRole: "usuario", adminRoles: ["admin"] }), nextCookies()],
});

export type Auth = typeof auth;
export type Session = Auth["$Infer"]["Session"];
export type SessionUser = Session["user"];
