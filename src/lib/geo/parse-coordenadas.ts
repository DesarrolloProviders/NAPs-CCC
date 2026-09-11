/**
 * Parser tolerante de coordenadas pegadas por el usuario.
 * Acepta:
 *   "-26.8419, -65.1622"      "-26.8419 -65.1622"     "-26,8419; -65,1622" (coma decimal si hay separador ; o espacio)
 *   URL de Google Maps: ".../@-26.8419,-65.1622,17z" o "?q=-26.8419,-65.1622" o "?ll=..."
 *   Objeto ya numérico.
 * Devuelve null si no encuentra un par válido dentro de rango.
 */
export interface Coordenadas {
  lat: number;
  lon: number;
}

/** Caja aproximada de Tucumán y alrededores, solo para advertir (no bloquea). */
export const BBOX_TUCUMAN = { latMin: -28.2, latMax: -26.0, lonMin: -66.3, lonMax: -64.4 } as const;

const NUM = String.raw`[-+]?\d{1,3}(?:[.,]\d+)?`;

function aNumero(s: string): number {
  return Number(s.replace(",", "."));
}

function enRango(c: Coordenadas): boolean {
  return Number.isFinite(c.lat) && Number.isFinite(c.lon) && Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180;
}

export function parseCoordenadas(entrada: string | null | undefined): Coordenadas | null {
  if (!entrada) return null;
  const texto = entrada.trim();
  if (!texto) return null;

  // 1) URL de Google Maps / OSM: @lat,lon  |  q=lat,lon  |  ll=lat,lon  |  mlat=..&mlon=..
  const url = texto.match(new RegExp(String.raw`(?:@|[?&](?:q|ll|query)=)(${NUM}),(${NUM})`));
  if (url?.[1] && url[2]) {
    const c = { lat: aNumero(url[1]), lon: aNumero(url[2]) };
    return enRango(c) ? c : null;
  }
  const osm = texto.match(new RegExp(String.raw`mlat=(${NUM}).*?mlon=(${NUM})`));
  if (osm?.[1] && osm[2]) {
    const c = { lat: aNumero(osm[1]), lon: aNumero(osm[2]) };
    return enRango(c) ? c : null;
  }

  // 2) Par de números separados por coma, punto y coma o espacios.
  //    Si ambos usan coma decimal ("-26,8419 -65,1622") el separador es espacio o ';'.
  const conPuntoDecimal = texto.match(/^([-+]?\d{1,3}\.\d+)\s*[,;\s]\s*([-+]?\d{1,3}\.\d+)$/);
  if (conPuntoDecimal?.[1] && conPuntoDecimal[2]) {
    const c = { lat: Number(conPuntoDecimal[1]), lon: Number(conPuntoDecimal[2]) };
    return enRango(c) ? c : null;
  }
  const conComaDecimal = texto.match(/^([-+]?\d{1,3},\d+)\s*[;\s]\s*([-+]?\d{1,3},\d+)$/);
  if (conComaDecimal?.[1] && conComaDecimal[2]) {
    const c = { lat: aNumero(conComaDecimal[1]), lon: aNumero(conComaDecimal[2]) };
    return enRango(c) ? c : null;
  }
  // Enteros o mezcla: "-26, -65"
  const generico = texto.match(/^([-+]?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*([-+]?\d{1,3}(?:\.\d+)?)$/);
  if (generico?.[1] && generico[2]) {
    const c = { lat: Number(generico[1]), lon: Number(generico[2]) };
    return enRango(c) ? c : null;
  }
  return null;
}

export function estaEnTucuman(c: Coordenadas): boolean {
  return (
    c.lat >= BBOX_TUCUMAN.latMin &&
    c.lat <= BBOX_TUCUMAN.latMax &&
    c.lon >= BBOX_TUCUMAN.lonMin &&
    c.lon <= BBOX_TUCUMAN.lonMax
  );
}

/** "-26.841908, -65.162219" (6 decimales ≈ 10 cm) */
export function formatoCoordenadas(c: Coordenadas): string {
  return `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}`;
}

/** Centro por defecto del mapa cuando todavía no hay búsqueda (San Miguel de Tucumán). */
export const CENTRO_DEFAULT: Coordenadas = { lat: -26.8241, lon: -65.2226 };
