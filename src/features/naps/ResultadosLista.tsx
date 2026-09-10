"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { CLASE_NIVEL, ETIQUETA_NIVEL, nivelDisponibilidad } from "@/features/naps/colores";
import { formatoMetros } from "@/lib/geo/formato";
import type { NapResumen } from "@/lib/gis/schema";
import { cn } from "@/lib/utils";

interface Props {
  naps: NapResumen[];
  seleccionada: string | null;
  onSeleccionar: (idNap: string) => void;
}

export function ResultadosLista({ naps, seleccionada, onSeleccionar }: Props) {
  const refs = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    if (!seleccionada) return;
    refs.current.get(seleccionada)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [seleccionada]);

  if (naps.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No hay NAPs dentro del radio con los filtros elegidos. Probá ampliar el radio.</p>;
  }

  return (
    <ol className="divide-y" aria-label="NAPs encontradas, ordenadas por distancia">
      {naps.map((n, i) => {
        const nivel = nivelDisponibilidad(n);
        const activa = n.idNap === seleccionada;
        return (
          <li
            key={n.fid}
            ref={(el) => {
              if (el) refs.current.set(n.idNap, el);
              else refs.current.delete(n.idNap);
            }}
            className={cn("cursor-pointer px-3 py-2 transition-colors hover:bg-muted/60", activa && "bg-primary/10 ring-1 ring-inset ring-primary/40")}
            onClick={() => onSeleccionar(n.idNap)}
            aria-current={activa ? "true" : undefined}
            data-testid={`resultado-${n.idNap}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                  <Link
                    href={`/naps/${encodeURIComponent(n.idNap)}`}
                    className="truncate font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {n.idNap}
                  </Link>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {n.localidad ?? "Sin localidad"}
                  {n.ubicacion ? ` · ${n.ubicacion}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm tabular-nums">{formatoMetros(n.metros)}</span>
                <Badge variant="outline" className={cn("text-[11px]", CLASE_NIVEL[nivel])} title={ETIQUETA_NIVEL[nivel]}>
                  {n.estado === "P" ? "Proyectada" : `${n.disponibles ?? "?"} / ${n.puertos ?? "?"} libres`}
                </Badge>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
