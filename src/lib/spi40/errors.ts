export type Spi40ErrorKind = "timeout" | "network" | "http" | "decode" | "schema" | "ws_error";

export interface Spi40WsError {
  property: string;
  message: string;
}

/** Error del webservice spi40 con clasificación para decidir reintentos y mensajes al usuario. */
export class Spi40Error extends Error {
  readonly kind: Spi40ErrorKind;
  readonly idAction: number;
  readonly detalles: Spi40WsError[];
  readonly causa: unknown;

  constructor(kind: Spi40ErrorKind, idAction: number, mensaje: string, opciones: { detalles?: Spi40WsError[]; causa?: unknown } = {}) {
    super(mensaje);
    this.name = "Spi40Error";
    this.kind = kind;
    this.idAction = idAction;
    this.detalles = opciones.detalles ?? [];
    this.causa = opciones.causa;
  }

  /** Solo se reintenta lo que pudo no haber llegado al servidor (GET idempotente). */
  get reintentable(): boolean {
    return this.kind === "timeout" || this.kind === "network";
  }

  toUserMessage(): string {
    switch (this.kind) {
      case "timeout":
        return "El sistema de abonados tardó demasiado en responder. Intentá de nuevo en unos segundos.";
      case "network":
      case "http":
        return "No se pudo conectar con el sistema de abonados. Verificá la conectividad con la red interna.";
      case "decode":
      case "schema":
        return "El sistema de abonados devolvió una respuesta inesperada. Avisá a sistemas si persiste.";
      case "ws_error":
        return this.detalles.length
          ? `El sistema de abonados rechazó la consulta: ${this.detalles.map((d) => d.message).join("; ")}`
          : "El sistema de abonados rechazó la consulta.";
    }
  }

  toJSON() {
    return { name: this.name, kind: this.kind, idAction: this.idAction, message: this.message, detalles: this.detalles };
  }
}

export function esSpi40Error(e: unknown): e is Spi40Error {
  return e instanceof Spi40Error;
}
