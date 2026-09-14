/**
 * Tareas de mantenimiento del proceso Next (se registra una vez al arrancar el servidor).
 * Purga de sesiones y verificaciones vencidas: better-auth no las borra y acumulan IP y user-agent.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { purgarVencidos } = await import("./lib/auth/purgar-vencidos");
  const CADA_MS = 6 * 60 * 60 * 1000;
  const correr = () => void purgarVencidos().catch(() => undefined);
  // Primer barrido a los 2 minutos (deja que migre/arranque tranquilo), después cada 6 h.
  setTimeout(correr, 2 * 60 * 1000).unref();
  setInterval(correr, CADA_MS).unref();
}
