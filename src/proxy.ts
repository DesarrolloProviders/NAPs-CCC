import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Chequeo OPTIMISTA de sesión (solo mira que exista la cookie) para redirigir rápido a /login.
 * La verificación real de la sesión la hace cada página/acción en el servidor (getSession).
 * Además propaga un id de request (x-request-id) para correlacionar logs con el access log del proxy.
 */
const PUBLICAS = ["/login", "/api/auth", "/api/health"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);

  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return conRequestId(NextResponse.next({ request: { headers } }), requestId);
  }
  const cookie = getSessionCookie(request, { cookiePrefix: "naps" });
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname + request.nextUrl.search)}` : "";
    return conRequestId(NextResponse.redirect(url), requestId);
  }
  return conRequestId(NextResponse.next({ request: { headers } }), requestId);
}

function conRequestId(res: NextResponse, id: string): NextResponse {
  res.headers.set("x-request-id", id);
  return res;
}

export const config = {
  // Todo salvo estáticos de Next y archivos con extensión (favicon, imágenes, etc.)
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
