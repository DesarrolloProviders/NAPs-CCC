"use client";

import { Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NapMapLazy } from "@/features/naps/NapMapLazy";
import { ResultadosLista } from "@/features/naps/ResultadosLista";
import { aQueryString, type BusquedaParams } from "@/features/naps/search-params";
import type { NapResumen } from "@/lib/gis/schema";

interface Props {
  params: BusquedaParams;
  naps: NapResumen[];
  truncado: boolean;
  limite: number;
}

/** Une lista y mapa con una selección compartida; el click en el mapa mueve el punto (cambia la URL). */
export function BuscarResultados({ params, naps, truncado, limite }: Props) {
  const router = useRouter();
  const [seleccionada, setSeleccionada] = useState<string | null>(params.focus ?? null);

  const onMoverPunto = useCallback(
    (lat: number, lon: number) => {
      router.replace(`/buscar?${aQueryString({ ...params, lat, lon, focus: undefined })}`);
    },
    [router, params],
  );

  async function compartir() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link de la búsqueda copiado");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  }

  return (
    <div className="grid flex-1 gap-4 lg:grid-cols-[380px_1fr]">
      <section className="flex min-h-0 flex-col rounded-lg border bg-card" aria-label="Resultados">
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="text-sm">
            <span className="font-medium">{naps.length}</span> NAP{naps.length === 1 ? "" : "s"} a {params.radio} m
            {truncado ? <span className="ml-1 text-amber-700">(se muestran las {limite} más cercanas)</span> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={compartir} title="Copiar link de esta búsqueda">
            <Share2 className="size-4" aria-hidden />
            <span className="sr-only">Copiar link</span>
          </Button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto lg:max-h-[calc(100vh-15rem)]">
          <ResultadosLista naps={naps} seleccionada={seleccionada} onSeleccionar={setSeleccionada} />
        </div>
      </section>
      <section className="min-h-[420px] overflow-hidden rounded-lg border lg:min-h-[calc(100vh-15rem)]" aria-label="Mapa">
        <NapMapLazy
          centro={{ lat: params.lat, lon: params.lon }}
          radio={params.radio}
          naps={naps}
          seleccionada={seleccionada}
          onSeleccionar={setSeleccionada}
          onMoverPunto={onMoverPunto}
        />
      </section>
    </div>
  );
}
