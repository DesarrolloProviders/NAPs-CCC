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
  trustedOrigins: [env.BETTER_AUTH_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 4,
    maxPasswordLength: 128,
    autoSignIn: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 días
    updateAge: 60 * 60 * 24, // renueva una vez por día
    // Corto a propósito: es el tiempo máximo que un usuario dado de baja o degradado conserva el acceso.
    cookieCache: { enabled: true, maxAge: env.AUTH_COOKIE_CACHE_S },
  },
  advanced: {
    cookiePrefix: "naps",
    // Secure solo si la URL pública es https (detrás de Apache/nginx con TLS). Con http:// (LAN, acceso directo al
    // puerto) la cookie viaja sin el flag; si no, el navegador la descarta y el login nunca "prende".
    useSecureCookies: env.BETTER_AUTH_URL.startsWith("https://"),
    // Detrás de nginx: la IP real viene en X-Forwarded-For (nginx la fija a $remote_addr y descarta la que traiga el cliente).
    // Si se agrega otro salto (Cloudflare, otro proxy), sumar `trustedProxies: ["<ip/cidr del salto>"]`.
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
  },
  // Igual que el default de better-auth: solo en producción (en dev y e2e hay muchos logins seguidos).
  rateLimit: {
    enabled: env.NODE_ENV === "production",
    window: 60,
    max: 30,
    customRules: { "/sign-in/email": { window: 60, max: 10 } },
  },
  // Endpoints del plugin admin y del core que la app no usa. Se apagan para achicar la superficie.
  disabledPaths: [
    "/admin/impersonate-user",
    "/admin/stop-impersonating",
    "/admin/remove-user",
    "/admin/set-user-email",
    "/admin/update-user",
    "/delete-user",
    "/change-email",
    "/update-user",
  ],
  plugins: [admin({ ac, roles: rolesAuth, defaultRole: "usuario", adminRoles: ["admin"] }), nextCookies()],
});

export type Auth = typeof auth;
export type Session = Auth["$Infer"]["Session"];
export type SessionUser = Session["user"];
