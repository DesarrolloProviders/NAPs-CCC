import { z } from "zod";

/**
 * Parámetros de búsqueda: la URL es el estado (compartible). Sin dependencias de servidor.
 *   /buscar?lat=-26.8419&lon=-65.1622&radio=500&disp=1&estado=I&loc=Banda%20del%20Rio%20Sali&focus=303-01-08-N08-1-E
 */
export const RADIO_DEFAULT = 500;
export const RADIO_MIN = 10;

export function busquedaSchema(radioMax: number) {
  return z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radio: z.coerce.number().int().min(RADIO_MIN).max(radioMax).default(RADIO_DEFAULT),
    disp: z
      .union([z.literal("1"), z.literal("0"), z.literal("true"), z.literal("false"), z.boolean()])
      .optional()
      .transform((v) => v === "1" || v === "true" || v === true),
    estado: z.enum(["I", "P"]).optional(),
    loc: z.string().trim().max(80).optional().transform((v) => (v ? v : undefined)),
    focus: z.string().trim().max(64).optional().transform((v) => (v ? v : undefined)),
  });
}

export type BusquedaParams = z.infer<ReturnType<typeof busquedaSchema>>;

type SearchParamsCrudos = Record<string, string | string[] | undefined>;

function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Devuelve los params validados, o null si no hay lat/lon (formulario vacío). Lanza si son inválidos. */
export function parsearBusqueda(sp: SearchParamsCrudos, radioMax: number): BusquedaParams | null {
  const lat = primero(sp.lat);
  const lon = primero(sp.lon);
  if (lat === undefined || lon === undefined || lat === "" || lon === "") return null;
  return busquedaSchema(radioMax).parse({
    lat,
    lon,
    radio: primero(sp.radio) ?? RADIO_DEFAULT,
    disp: primero(sp.disp),
    estado: primero(sp.estado) || undefined,
    loc: primero(sp.loc),
    focus: primero(sp.focus),
  });
}

/** Serializa a query string (omite defaults) para construir URLs compartibles. */
export function aQueryString(p: Partial<BusquedaParams> & { lat: number; lon: number }): string {
  const q = new URLSearchParams();
  q.set("lat", p.lat.toFixed(6));
  q.set("lon", p.lon.toFixed(6));
  if (p.radio && p.radio !== RADIO_DEFAULT) q.set("radio", String(p.radio));
  if (p.disp) q.set("disp", "1");
  if (p.estado) q.set("estado", p.estado);
  if (p.loc) q.set("loc", p.loc);
  if (p.focus) q.set("focus", p.focus);
  return q.toString();
}
