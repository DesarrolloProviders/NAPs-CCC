import "server-only";
import { headers } from "next/headers";
import pino, { type Logger } from "pino";

/**
 * Logger estructurado. JSON en producción; legible en desarrollo.
 * Usar `loggerDe("spi40")` por servicio para poder filtrar, y `loggerDeRequest` dentro de una request
 * para que cada línea lleve el `reqId` que también aparece en el access log de nginx (X-Request-Id).
 */
const nivel = process.env.LOG_LEVEL ?? "info";
const esDev = process.env.NODE_ENV !== "production";

export const logger: Logger = pino({
  level: nivel,
  base: { app: "naps-ccc" },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Por si algún objeto con credenciales termina en un log: se enmascara antes de escribir.
  redact: {
    paths: ["*.password", "*.newPassword", "*.currentPassword", "*.authorization", "*.cookie", "*.token", "*.secret"],
    censor: "[oculto]",
  },
  ...(esDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,app" },
        },
      }
    : {}),
});

export type Servicio = "spi40" | "olt" | "gis" | "auth" | "http" | "usuarios";

export function loggerDe(svc: Servicio): Logger {
  return logger.child({ svc });
}

/**
 * Logger con el id de la request actual (cabecera x-request-id que fija src/proxy.ts).
 * Solo dentro de páginas, route handlers y Server Actions; fuera de una request devuelve el logger sin reqId.
 */
export async function loggerDeRequest(svc: Servicio): Promise<Logger> {
  try {
    const reqId = (await headers()).get("x-request-id");
    return reqId ? logger.child({ svc, reqId }) : loggerDe(svc);
  } catch {
    return loggerDe(svc);
  }
}
