"use client";

import { useQuery } from "@tanstack/react-query";
import type { EstadoOltRespuesta } from "@/app/api/naps/[idNap]/olt/route";

/** Pide el estado OLT de una NAP a la API propia. Lanza con el mensaje del servidor si la respuesta no es 2xx. */
export async function fetchEstadoOlt(idNap: string, opciones: { refresh?: boolean; signal?: AbortSignal } = {}): Promise<EstadoOltRespuesta> {
  const query = opciones.refresh ? "?refresh=1" : "";
  const r = await fetch(`/api/naps/${encodeURIComponent(idNap)}/olt${query}`, { signal: opciones.signal, credentials: "same-origin" });
  if (!r.ok) {
    const cuerpo = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(cuerpo.error ?? `Error ${r.status}`);
  }
  return (await r.json()) as EstadoOltRespuesta;
}

/** Estado online de las ONTs de una NAP, consultado en diferido (la OLT es lenta). */
export function useOltStatus(idNap: string, habilitado: boolean) {
  return useQuery({
    queryKey: ["olt", idNap],
    enabled: habilitado,
    staleTime: 60_000,
    retry: 0,
    queryFn: ({ signal }) => fetchEstadoOlt(idNap, { signal }),
  });
}
