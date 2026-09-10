"use client";

import { useQuery } from "@tanstack/react-query";
import type { EstadoOltRespuesta } from "@/app/api/naps/[idNap]/olt/route";

/** Estado online de las ONTs de una NAP, consultado en diferido (la OLT es lenta). */
export function useOltStatus(idNap: string, habilitado: boolean) {
  return useQuery({
    queryKey: ["olt", idNap],
    enabled: habilitado,
    staleTime: 60_000,
    retry: 0,
    queryFn: async ({ signal }): Promise<EstadoOltRespuesta> => {
      const r = await fetch(`/api/naps/${encodeURIComponent(idNap)}/olt`, { signal, credentials: "same-origin" });
      if (!r.ok) {
        const cuerpo = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(cuerpo.error ?? `Error ${r.status}`);
      }
      return (await r.json()) as EstadoOltRespuesta;
    },
  });
}
