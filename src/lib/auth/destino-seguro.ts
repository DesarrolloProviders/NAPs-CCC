/**
 * Valida el destino post-login (`?next=`): solo rutas internas absolutas ("/x?y").
 * Rechaza "//host", "/\host", esquemas y caracteres de control (open redirect).
 * Puro, sin `server-only`: se usa en la página (servidor) y en el formulario (cliente).
 */
export function destinoSeguro(next: unknown, fallback = "/buscar"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\s]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://interno");
    if (u.origin !== "http://interno" || u.pathname.startsWith("//")) return fallback;
    return u.pathname + u.search;
  } catch {
    return fallback;
  }
}
