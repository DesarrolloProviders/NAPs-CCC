import { z } from "zod";

/** Entradas de las acciones de reservas (se validan en cliente para feedback y en servidor como autoridad). */
export const reservarPuertoSchema = z.object({
  idNap: z.string().trim().min(3).max(64),
  idNodo: z.coerce.number().int().positive(),
  puerto: z.coerce.number().int().min(1).max(64),
  observacion: z.string().trim().min(3, "Ingresá al menos 3 caracteres (por ejemplo el número de abonado)").max(500),
  diasVigencia: z.coerce.number().int().min(1).max(365).optional(),
});
export type ReservarPuertoInput = z.infer<typeof reservarPuertoSchema>;

export const liberarReservaSchema = z.object({
  reservaId: z.coerce.number().int().positive(),
  motivo: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)),
});
export type LiberarReservaInput = z.infer<typeof liberarReservaSchema>;

export const instalarPuertoSchema = z.object({
  idNap: z.string().trim().min(3).max(64),
  idNodo: z.coerce.number().int().positive(),
  puerto: z.coerce.number().int().min(1).max(64),
  nroAbonado: z
    .string()
    .trim()
    .regex(/^[0-9]{3,12}$/, "El número de abonado debe tener solo dígitos"),
  observacion: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)),
});
export type InstalarPuertoInput = z.infer<typeof instalarPuertoSchema>;

export type CodigoErrorReserva =
  | "PERMISO_DENEGADO"
  | "DATOS_INVALIDOS"
  | "SPI40_NO_DISPONIBLE"
  | "PUERTO_NO_PERTENECE"
  | "PUERTO_OCUPADO"
  | "PUERTO_YA_RESERVADO"
  | "RESERVA_NO_ENCONTRADA"
  | "RESERVA_NO_ACTIVA"
  | "ERROR_INTERNO";

export type ResultadoReserva<T = undefined> = { ok: true; data: T } | { ok: false; codigo: CodigoErrorReserva; mensaje: string };

export const MENSAJE_ERROR: Record<CodigoErrorReserva, string> = {
  PERMISO_DENEGADO: "No tenés permiso para esta acción.",
  DATOS_INVALIDOS: "Los datos ingresados no son válidos.",
  SPI40_NO_DISPONIBLE: "No se pudo verificar el puerto en el sistema de abonados. No se reserva a ciegas: reintentá en unos segundos.",
  PUERTO_NO_PERTENECE: "El puerto no pertenece a esta NAP según el sistema de abonados.",
  PUERTO_OCUPADO: "El puerto figura ocupado en el sistema de abonados: no se puede reservar.",
  PUERTO_YA_RESERVADO: "El puerto ya tiene una reserva vigente.",
  RESERVA_NO_ENCONTRADA: "La reserva no existe.",
  RESERVA_NO_ACTIVA: "La reserva ya no está activa.",
  ERROR_INTERNO: "Ocurrió un error inesperado. Reintentá o avisá a sistemas.",
};
