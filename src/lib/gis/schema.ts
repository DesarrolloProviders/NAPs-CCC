/**
 * Tipos de la tabla PostGIS `nap_con_disponibilidad` (base cccqgis del servidor GIS).
 * No hay migraciones: la tabla la administra QGIS. Solo describimos lo que leemos.
 *
 * Notas de datos reales (relevadas 2026-09-09):
 *  - geom: Point SRID 4326 (lon/lat WGS84)
 *  - id_nap: código (ej. "303-01-08-N08-1-E"); puede traer espacios sucios
 *  - estado: 'I' instalada | 'P' proyectada
 *  - puertos: 8 | 16 ; disponibles: puertos libres según spi40 (sincronizado en lote por el legacy)
 *  - slot_1..slot_16: vacíos en casi todas las filas → no se usan
 */
export const TABLA_NAPS = "nap_con_disponibilidad" as const;

export type EstadoNap = "I" | "P";

/** Fila resumida que devuelve la búsqueda por radio. */
export interface NapResumen {
  fid: number;
  idNap: string;
  localidad: string | null;
  ubicacion: string | null;
  puertos: number | null;
  disponibles: number | null;
  estado: EstadoNap | null;
  lat: number;
  lon: number;
  /** Distancia al punto buscado, en metros. */
  metros: number;
  ultimaModificacion: string | null;
}

/** Fila completa para la página de detalle. */
export interface NapDetalle extends Omit<NapResumen, "metros"> {
  tipo: string | null;
  obra: string | null;
  olt: string | null;
  pon: number | null;
  observacion: string | null;
  cantidadSlot: number | null;
  edfa: boolean | null;
  spliteo: number | null;
  placa: number | null;
}
