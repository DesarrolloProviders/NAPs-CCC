import "server-only";
import { env } from "@/lib/env";
import { buscarNaps as buscarNapsGis, listarLocalidades as listarLocalidadesGis } from "@/lib/gis/queries";
import type { NapResumen } from "@/lib/gis/schema";
import type { BusquedaParams } from "@/features/naps/search-params";

export interface ResultadoBusqueda {
  naps: NapResumen[];
  /** true si se alcanzó BUSQUEDA_MAX_RESULTADOS (hay más NAPs que no se muestran). */
  truncado: boolean;
  limite: number;
}

/** Ejecuta la búsqueda por radio aplicando los límites configurados. */
export async function buscarNaps(p: BusquedaParams): Promise<ResultadoBusqueda> {
  const limite = env.BUSQUEDA_MAX_RESULTADOS;
  const naps = await buscarNapsGis({
    lat: p.lat,
    lon: p.lon,
    radio: p.radio,
    soloDisponibles: p.disp,
    estado: p.estado,
    localidad: p.loc,
    limite,
  });
  return { naps, truncado: naps.length >= limite, limite };
}

export async function listarLocalidades(): Promise<string[]> {
  return listarLocalidadesGis();
}

export function limitesBusqueda() {
  return { radioDefault: env.BUSQUEDA_RADIO_DEFAULT_M, radioMax: env.BUSQUEDA_RADIO_MAX_M, maxResultados: env.BUSQUEDA_MAX_RESULTADOS };
}
