import { z } from "zod";

/**
 * Schemas zod de las respuestas de spi40. PHP devuelve números como strings y campos vacíos como "",
 * por eso se usa `coerce` y normalizadores. `.loose()` para no romper si agregan campos.
 */

// Los campos pueden faltar, venir null, "" o con otro tipo: `unknown` + transform tolera todo eso
// (y en zod 4 deja la clave opcional en el tipo de entrada).
const texto = z.unknown().optional().transform((v) => (v === null || v === undefined || typeof v === "object" ? "" : String(v).trim()));

const textoOpcional = texto.transform((v) => (v === "" ? null : v));

const entero = z.unknown().optional().transform((v) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean" || typeof v === "object") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
});

const decimal = z.unknown().optional().transform((v) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean" || typeof v === "object") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
});

/** MAC: vacía o literal "N/A" → null; se normaliza a minúsculas sin separadores (como la usa la OLT). */
export const macSchema = texto.transform((v) => {
  const limpio = v.toLowerCase().replace(/[^0-9a-f]/g, "");
  if (!limpio || v.toUpperCase() === "N/A") return null;
  return limpio;
});

export const wsErrorSchema = z
  .object({ property: texto, message: texto })
  .loose();

/** Sobre común: [{ result_ok, id_request, id_transaction, errors[], records[] }] */
export const envelopeSchema = z
  .array(
    z
      .object({
        result_ok: z.unknown().optional().transform((v) => v === true || v === "true" || v === 1 || v === "1"),
        id_request: z.unknown().optional(),
        id_transaction: z.unknown().optional(),
        errors: z.unknown().optional().transform((v) => (Array.isArray(v) ? v.map((e) => wsErrorSchema.parse(e)) : [])),
        records: z.unknown().optional().transform((v) => (Array.isArray(v) ? (v as unknown[]) : [])),
      })
      .loose(),
  )
  .min(1);

export type Envelope = z.infer<typeof envelopeSchema>[number];

/** id_action 22024 — puertos de una NAP. `estado` NO indica ocupación (1 Activo, 2 Inactivo, 3 Mantenimiento, 4 Operativo). */
export const puertoNapSchema = z
  .object({
    id_nodo: entero,
    id_padre: entero,
    puerto: entero,
    estado: entero,
    tipo: entero,
    descripcion: texto,
    id_cli: entero,
    denominacion_cli: textoOpcional,
    mac_ont: macSchema,
    serial_ont: textoOpcional,
    modelo_ont: textoOpcional,
  })
  .loose();
export type PuertoNapWs = z.infer<typeof puertoNapSchema>;

/** id_action 22002 — ONT / cliente (por mac, id_cliente, nombre o domicilio). */
export const ontClienteSchema = z
  .object({
    mac_ont: macSchema,
    serial_ont: textoOpcional,
    marca_ont: textoOpcional,
    modelo_ont: textoOpcional,
    tiene_wifi: z.unknown().optional(),
    id_cli: entero,
    denominacion_cli: textoOpcional,
    responsable_cli: textoOpcional,
    telefonos_cli: textoOpcional,
    email_cli: textoOpcional,
    descripcion_pack: textoOpcional,
    estado_pack: textoOpcional,
    nombre_ser: textoOpcional,
    id_loc_cli_pack_serv: entero,
    calle_loc: textoOpcional,
    numero_loc: textoOpcional,
    piso_loc: textoOpcional,
    departamento_loc: textoOpcional,
    localidad_loc: textoOpcional,
    provincia_loc: textoOpcional,
    entre_calle_loc: textoOpcional,
    y_calle: textoOpcional,
    latitud_loc: decimal,
    longitud_loc: decimal,
    descripcion: textoOpcional,
    puerto: entero,
  })
  .loose();
export type OntClienteWs = z.infer<typeof ontClienteSchema>;

/** id_action 22015 — NAPs/splitters con cantidad de puertos disponibles. */
export const napDisponibleSchema = z
  .object({
    id_nodo_arbol: entero,
    descripcion: texto,
    disponibles: entero,
    latitud: decimal,
    longitud: decimal,
  })
  .loose();
export type NapDisponibleWs = z.infer<typeof napDisponibleSchema>;

export const ID_ACTION = {
  PUERTOS_NAP: 22024,
  ONT_CLIENTE: 22002,
  NAPS_DISPONIBLES: 22015,
  PUERTOS_POR_UBICACION: 22011,
  EVENTOS_CLIENTE: 103,
} as const;
