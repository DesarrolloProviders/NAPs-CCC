import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Chequeo OPTIMISTA de sesión (solo mira que exista la cookie) para redirigir rápido a /login.
 * La verificación real de la sesión la hace cada página/acción en el servidor (getSession).
 */
// /api/cron valida su propio secreto (no usa sesión)
const PUBLICAS = ["/login", "/api/auth", "/api/health", "/api/cron"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const cookie = getSessionCookie(request, { cookiePrefix: "naps" });
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname + request.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Todo salvo estáticos de Next y archivos con extensión (favicon, imágenes, etc.)
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
