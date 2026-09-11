import { z } from "zod";
import { BBOX_TUCUMAN, type Coordenadas } from "@/lib/geo/parse-coordenadas";

/**
 * Geocodificador de direcciones (calle y número) para la búsqueda por radio.
 *
 * Corre EN EL NAVEGADOR, igual que los tiles del mapa: el servidor interno puede no
 * tener salida a internet. Usa Nominatim (OSM) porque es gratis y no necesita clave;
 * `NEXT_PUBLIC_GEOCODER_URL` permite apuntar a otro Nominatim (propio o pago) sin tocar código.
 *
 * Cobertura real en Tucumán (medida 2026-09-11): capital tiene altura casa por casa;
 * en el interior suele devolver el eje de la calle. Por eso siempre se informa la
 * precisión y el usuario puede corregir con un click en el mapa.
 */
const URL_BASE = process.env.NEXT_PUBLIC_GEOCODER_URL ?? "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 10_000;
/** Política de uso de Nominatim: máximo 1 consulta por segundo y nada de autocompletado. */
const INTERVALO_MIN_MS = 1100;

export type PrecisionGeocodificacion = "exacta" | "calle" | "aproximada";

export interface DireccionGeocodificada {
  coord: Coordenadas;
  /** Dirección tal como la entendió el geocodificador, para que el usuario confirme. */
  etiqueta: string;
  precision: PrecisionGeocodificacion;
}

const resultadoSchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  display_name: z.string(),
  /** 30 = altura exacta, 26-29 = calle, menos = barrio/localidad. */
  place_rank: z.coerce.number().optional(),
});

const respuestaSchema = z.array(resultadoSchema);

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/** Un texto es dirección (y no coordenadas) si tiene alguna letra. */
export function pareceDireccion(texto: string): boolean {
  return /\p{L}/u.test(texto);
}

/**
 * Arma la consulta con el mismo formato que ya se usaba para geocodificar abonados
 * ("COLOMBIA 187, Yerba Buena, Tucumán, Argentina"), sin duplicar lo que el usuario ya escribió.
 */
export function construirConsulta(texto: string, localidad?: string | null): string {
  const base = texto.trim().replace(/\s+/g, " ");
  const partes = [base];
  const yaTiene = (s: string) => norm(base).includes(norm(s));
  if (localidad && !yaTiene(localidad)) partes.push(localidad);
  if (!yaTiene("tucuman")) partes.push("Tucumán");
  if (!yaTiene("argentina")) partes.push("Argentina");
  return partes.join(", ");
}

export function precisionDe(placeRank: number | undefined): PrecisionGeocodificacion {
  if (placeRank === undefined) return "aproximada";
  if (placeRank >= 30) return "exacta";
  if (placeRank >= 26) return "calle";
  return "aproximada";
}

export function textoPrecision(p: PrecisionGeocodificacion): string {
  if (p === "exacta") return "altura exacta";
  if (p === "calle") return "solo la calle, sin altura: ajustá con un click en el mapa";
  return "ubicación aproximada: ajustá con un click en el mapa";
}

function url(consulta: string): string {
  const q = new URLSearchParams({
    q: consulta,
    format: "jsonv2",
    limit: "1",
    countrycodes: "ar",
    "accept-language": "es",
    // Acota a Tucumán: todas las NAPs están en la provincia. viewbox = lon,lat,lon,lat
    viewbox: `${BBOX_TUCUMAN.lonMin},${BBOX_TUCUMAN.latMin},${BBOX_TUCUMAN.lonMax},${BBOX_TUCUMAN.latMax}`,
    bounded: "1",
  });
  return `${URL_BASE}?${q}`;
}

/** Caché por consulta: evita repetir el pedido si el usuario vuelve a apretar Buscar. */
const cache = new Map<string, DireccionGeocodificada | null>();
let ultimoPedido = 0;

async function esperarTurno(): Promise<void> {
  const espera = ultimoPedido + INTERVALO_MIN_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimoPedido = Date.now();
}

export class GeocodificadorError extends Error {
  constructor(
    mensaje: string,
    readonly causa?: unknown,
  ) {
    super(mensaje);
    this.name = "GeocodificadorError";
  }
}

/** Devuelve la mejor coincidencia, o null si no se encontró la dirección. Lanza si falla la red. */
export async function geocodificar(texto: string, opciones: { localidad?: string | null } = {}): Promise<DireccionGeocodificada | null> {
  const consulta = construirConsulta(texto, opciones.localidad);
  const enCache = cache.get(consulta);
  if (enCache !== undefined) return enCache;

  await esperarTurno();
  let respuesta: Response;
  try {
    respuesta = await fetch(url(consulta), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new GeocodificadorError("No se pudo consultar el servicio de direcciones. Probá de nuevo o usá coordenadas.", e);
  }
  if (!respuesta.ok) {
    throw new GeocodificadorError(`El servicio de direcciones respondió ${respuesta.status}. Probá de nuevo o usá coordenadas.`);
  }

  const datos = respuestaSchema.safeParse(await respuesta.json());
  if (!datos.success) throw new GeocodificadorError("El servicio de direcciones devolvió una respuesta inesperada.");

  const primero = datos.data[0];
  const encontrado: DireccionGeocodificada | null = primero
    ? {
        coord: { lat: primero.lat, lon: primero.lon },
        etiqueta: primero.display_name,
        precision: precisionDe(primero.place_rank),
      }
    : null;
  cache.set(consulta, encontrado);
  return encontrado;
}

/** Solo para tests. */
export function limpiarCacheGeocodificador(): void {
  cache.clear();
  ultimoPedido = 0;
}
