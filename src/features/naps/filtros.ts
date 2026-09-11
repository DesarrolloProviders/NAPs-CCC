import { aQueryString, type BusquedaParams } from "@/features/naps/search-params";
import { formatoCoordenadas, type Coordenadas } from "@/lib/geo/parse-coordenadas";

/**
 * Estado del formulario de búsqueda. Vive en el panel (no en el form) porque el click
 * en el mapa también dispara una búsqueda y necesita los mismos filtros.
 */
export const TODAS = "__todas__";
export const ESTADO_TODOS = "__todos__";

export interface Filtros {
  coordTexto: string;
  /** Texto del input; puede estar vacío o inválido mientras se edita. */
  radio: string;
  disp: boolean;
  estado: string;
  loc: string;
}

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

export function filtrosIniciales(inicial: BusquedaParams | null, localidades: string[], radioDefault: number): Filtros {
  return {
    coordTexto: inicial ? formatoCoordenadas({ lat: inicial.lat, lon: inicial.lon }) : "",
    radio: String(inicial?.radio ?? radioDefault),
    disp: inicial?.disp ?? false,
    estado: inicial?.estado ?? ESTADO_TODOS,
    // La URL puede traer la localidad con otra capitalización o sin tildes: se muestra la versión canónica de la lista.
    loc: inicial?.loc ? (localidades.find((l) => norm(l) === norm(inicial.loc!)) ?? inicial.loc) : TODAS,
  };
}

/** Radio elegido en el formulario, o el default si el input todavía no es un número usable. */
export function radioDeFiltros(f: Filtros, radioDefault: number, radioMax: number): number {
  const r = Math.round(Number(f.radio));
  return Number.isFinite(r) && r >= 10 && r <= radioMax ? r : radioDefault;
}

/** Query string de una búsqueda en `c` con los filtros actuales (descarta la NAP enfocada). */
export function queryDeFiltros(f: Filtros, c: Coordenadas, radio: number): string {
  return aQueryString({
    lat: c.lat,
    lon: c.lon,
    radio,
    disp: f.disp,
    estado: f.estado === ESTADO_TODOS ? undefined : (f.estado as "I" | "P"),
    loc: f.loc === TODAS ? undefined : f.loc,
  });
}
