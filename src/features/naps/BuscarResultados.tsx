"use client";

import { MousePointerClick, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NapMapLazy } from "@/features/naps/NapMapLazy";
import { ResultadosLista } from "@/features/naps/ResultadosLista";
import type { BusquedaParams } from "@/features/naps/search-params";
import { CENTRO_DEFAULT } from "@/lib/geo/parse-coordenadas";
import type { NapResumen } from "@/lib/gis/schema";

interface Props {
  /** null mientras no hay búsqueda: el mapa igual se muestra y el click la dispara. */
  params: BusquedaParams | null;
  naps: NapResumen[];
  truncado: boolean;
  limite: number;
  /** Radio elegido en el formulario (se usa para el círculo y para el click en el mapa). */
  radio: number;
  seleccionada: string | null;
  onSeleccionar: (idNap: string) => void;
  onMoverPunto: (lat: number, lon: number) => void;
}

/** Une lista y mapa con una selección compartida; el click en el mapa mueve el punto (cambia la URL). */
export function BuscarResultados({ params, naps, truncado, limite, radio, seleccionada, onSeleccionar, onMoverPunto }: Props) {
  const centro = params ? { lat: params.lat, lon: params.lon } : CENTRO_DEFAULT;

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
            {params ? (
              <>
                <span className="font-medium">{naps.length}</span> NAP{naps.length === 1 ? "" : "s"} a {params.radio} m
                {truncado ? <span className="ml-1 text-amber-700">(se muestran las {limite} más cercanas)</span> : null}
              </>
            ) : (
              <span className="text-muted-foreground">Sin búsqueda todavía</span>
            )}
          </div>
          {params ? (
            <Button variant="ghost" size="sm" onClick={compartir} title="Copiar link de esta búsqueda">
              <Share2 className="size-4" aria-hidden />
              <span className="sr-only">Copiar link</span>
            </Button>
          ) : null}
        </header>
        <div className="max-h-[70vh] overflow-y-auto lg:max-h-[calc(100vh-15rem)]">
          {params ? (
            <ResultadosLista naps={naps} seleccionada={seleccionada} onSeleccionar={onSeleccionar} />
          ) : (
            <p className="p-4 text-sm text-muted-foreground" data-testid="sin-busqueda">
              Escribí una dirección arriba (por ejemplo &quot;Córdoba 1083&quot;), pegá coordenadas o un link de Google Maps, o hacé click en el
              mapa para buscar NAPs alrededor de ese punto. El radio y los filtros que elijas se aplican también al click.
            </p>
          )}
        </div>
      </section>
      <section className="relative min-h-[420px] overflow-hidden rounded-lg border lg:min-h-[calc(100vh-15rem)]" aria-label="Mapa">
        {!params ? (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center">
            <p className="flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-sm shadow-sm">
              <MousePointerClick className="size-4" aria-hidden />
              Hacé click en el mapa para buscar en un radio de {radio} m
            </p>
          </div>
        ) : null}
        <NapMapLazy
          centro={centro}
          radio={params?.radio ?? radio}
          radioVista={params ? undefined : 4000}
          marcarCentro={params !== null}
          naps={naps}
          seleccionada={seleccionada}
          onSeleccionar={onSeleccionar}
          onMoverPunto={onMoverPunto}
        />
      </section>
    </div>
  );
}
