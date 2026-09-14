import "server-only";
import { gisSql } from "@/lib/gis/client";
import { TABLA_NAPS, type EstadoNap, type NapDetalle, type NapResumen } from "@/lib/gis/schema";
import { normalizarIdNap } from "@/lib/nap/normalizar-id-nap";
import { loggerDe } from "@/lib/logger";

const log = loggerDe("gis");

export interface ParametrosBusqueda {
  lat: number;
  lon: number;
  /** Radio en metros. */
  radio: number;
  /** Solo NAPs con disponibles > 0. */
  soloDisponibles?: boolean;
  estado?: EstadoNap;
  /** Localidad (comparación sin tildes ni mayúsculas). */
  localidad?: string;
  limite: number;
}

interface FilaResumen {
  fid: number;
  id_nap: string;
  localidad: string | null;
  ubicacion: string | null;
  puertos: number | null;
  disponibles: number | null;
  estado: string | null;
  lat: number;
  lon: number;
  metros: number;
  ultima_modificacion: string | null;
}

function aResumen(f: FilaResumen): NapResumen {
  return {
    fid: f.fid,
    idNap: f.id_nap.trim(),
    localidad: f.localidad?.trim() || null,
    ubicacion: f.ubicacion?.trim() || null,
    puertos: f.puertos,
    disponibles: f.disponibles,
    estado: f.estado === "I" || f.estado === "P" ? f.estado : null,
    lat: Number(f.lat),
    lon: Number(f.lon),
    metros: Number(f.metros),
    ultimaModificacion: f.ultima_modificacion,
  };
}

/**
 * Expresión SQL de localidad normalizada (sin tildes, minúsculas).
 * INVARIANTE: es una constante literal y es lo ÚNICO que pasa por `gisSql.unsafe` en el proyecto.
 * Nunca interpolar acá nada que venga del usuario o del entorno.
 */
const LOCALIDAD_NORM = `translate(lower(trim(localidad)), 'áéíóúüñ', 'aeiouun')`;

/**
 * NAPs dentro de un radio del punto, ordenadas por distancia.
 * geography → distancias reales en metros. Sin índice espacial en origen, pero con ~2.300 filas responde en ms.
 */
export async function buscarNaps(p: ParametrosBusqueda): Promise<NapResumen[]> {
  const inicio = performance.now();
  const punto = gisSql`ST_SetSRID(ST_MakePoint(${p.lon}, ${p.lat}), 4326)::geography`;
  const localidadNorm = p.localidad ? normalizarTexto(p.localidad) : null;

  const filas = await gisSql<FilaResumen[]>`
    SELECT fid, id_nap, localidad, ubicacion, puertos, disponibles, estado,
           ST_Y(geom)::float8 AS lat, ST_X(geom)::float8 AS lon,
           ST_Distance(geom::geography, ${punto})::float8 AS metros,
           to_char(ultima_modificacion, 'YYYY-MM-DD') AS ultima_modificacion
    FROM ${gisSql(TABLA_NAPS)}
    WHERE geom IS NOT NULL
      AND id_nap IS NOT NULL
      AND ST_DWithin(geom::geography, ${punto}, ${p.radio})
      ${p.soloDisponibles ? gisSql`AND COALESCE(disponibles, 0) > 0` : gisSql``}
      ${p.estado ? gisSql`AND estado = ${p.estado}` : gisSql``}
      ${localidadNorm ? gisSql`AND ${gisSql.unsafe(LOCALIDAD_NORM)} = ${localidadNorm}` : gisSql``}
    ORDER BY metros ASC
    LIMIT ${p.limite}
  `;

  log.debug({ lat: p.lat, lon: p.lon, radio: p.radio, filas: filas.length, ms: Math.round(performance.now() - inicio) }, "buscarNaps");
  return filas.map(aResumen);
}

/** Localidades distintas, normalizadas (sin duplicados por tildes). */
export async function listarLocalidades(): Promise<string[]> {
  const filas = await gisSql<{ localidad: string }[]>`
    SELECT MIN(trim(localidad)) AS localidad
    FROM ${gisSql(TABLA_NAPS)}
    WHERE localidad IS NOT NULL AND trim(localidad) <> ''
    GROUP BY ${gisSql.unsafe(LOCALIDAD_NORM)}
    ORDER BY 1
  `;
  return filas.map((f) => f.localidad);
}

interface FilaDetalle extends FilaResumen {
  tipo: string | null;
  obra: string | null;
  olt: string | null;
  pon: number | null;
  observacion: string | null;
  cantidad_slot: number | null;
  edfa: boolean | null;
  spliteo: number | null;
  placa: number | null;
}

/** Busca una NAP por código (normalizando espacios y guiones de ambos lados). */
export async function obtenerNapPorCodigo(idNap: string): Promise<NapDetalle | null> {
  const norm = normalizarIdNap(idNap);
  if (!norm) return null;
  const filas = await gisSql<FilaDetalle[]>`
    SELECT fid, id_nap, localidad, ubicacion, puertos, disponibles, estado, tipo, obra, olt, pon, observacion,
           cantidad_slot, edfa, spliteo, placa,
           ST_Y(geom)::float8 AS lat, ST_X(geom)::float8 AS lon, 0::float8 AS metros,
           to_char(ultima_modificacion, 'YYYY-MM-DD') AS ultima_modificacion
    FROM ${gisSql(TABLA_NAPS)}
    WHERE upper(replace(regexp_replace(id_nap, '\s', '', 'g'), '_', '-')) = ${norm}
    ORDER BY (geom IS NOT NULL) DESC
    LIMIT 1
  `;
  const f = filas[0];
  if (!f) return null;
  const { metros: _metros, ...resumen } = aResumen(f);
  void _metros;
  return {
    ...resumen,
    tipo: f.tipo,
    obra: f.obra,
    olt: f.olt,
    pon: f.pon,
    observacion: f.observacion?.trim() || null,
    cantidadSlot: f.cantidad_slot,
    edfa: f.edfa,
    spliteo: f.spliteo,
    placa: f.placa,
  };
}

/** Comprobación de salud: 1 query trivial. */
export async function pingGis(): Promise<boolean> {
  try {
    await gisSql`SELECT 1`;
    return true;
  } catch (error) {
    log.error({ error }, "pingGis falló");
    return false;
  }
}

function normalizarTexto(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}
