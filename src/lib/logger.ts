import "server-only";
import pino, { type Logger } from "pino";

/**
 * Logger estructurado. JSON en producción; legible en desarrollo.
 * Usar `logger.child({ svc: "spi40" })` por servicio para poder filtrar.
 */
const nivel = process.env.LOG_LEVEL ?? "info";
const esDev = process.env.NODE_ENV !== "production";

export const logger: Logger = pino({
  level: nivel,
  base: { app: "naps-ccc" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(esDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,app" },
        },
      }
    : {}),
});

export type Servicio = "spi40" | "olt" | "gis" | "reservas" | "auth" | "http" | "usuarios";

export function loggerDe(svc: Servicio): Logger {
  return logger.child({ svc });
}
