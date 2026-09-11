"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { BuscarForm } from "@/features/naps/BuscarForm";
import { BuscarResultados } from "@/features/naps/BuscarResultados";
import { filtrosIniciales, queryDeFiltros, radioDeFiltros, type Filtros } from "@/features/naps/filtros";
import type { BusquedaParams } from "@/features/naps/search-params";
import { formatoCoordenadas, type Coordenadas } from "@/lib/geo/parse-coordenadas";
import type { NapResumen } from "@/lib/gis/schema";

interface Props {
  /** Búsqueda de la URL (alimenta los filtros aunque PostGIS haya fallado). */
  inicial: BusquedaParams | null;
  /** false si no hay búsqueda en la URL o si la consulta falló: el mapa se muestra vacío. */
  hayResultado: boolean;
  localidades: string[];
  radioMax: number;
  radioDefault: number;
  naps: NapResumen[];
  truncado: boolean;
  limite: number;
}

/**
 * Dueño del estado del formulario: lo comparten el form y el mapa, porque hay dos formas
 * de buscar (escribir coordenadas + Buscar, o hacer click en el mapa) y ambas usan los
 * mismos filtros. La búsqueda en sí sigue viviendo en la URL.
 */
export function BuscarPanel({ inicial, hayResultado, localidades, radioMax, radioDefault, naps, truncado, limite }: Props) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [filtros, setFiltros] = useState<Filtros>(() => filtrosIniciales(inicial, localidades, radioDefault));
  const [seleccionada, setSeleccionada] = useState<string | null>(inicial?.focus ?? null);

  const cambiar = useCallback((parcial: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...parcial })), []);

  const buscarEn = useCallback(
    (c: Coordenadas, radio: number) => {
      startTransition(() => router.replace(`/buscar?${queryDeFiltros(filtros, c, radio)}`));
    },
    [router, filtros],
  );

  const onBuscar = useCallback((c: Coordenadas) => buscarEn(c, Math.round(Number(filtros.radio))), [buscarEn, filtros.radio]);

  const onMoverPunto = useCallback(
    (lat: number, lon: number) => {
      const c = { lat, lon };
      setSeleccionada(null);
      cambiar({ coordTexto: formatoCoordenadas(c) });
      buscarEn(c, radioDeFiltros(filtros, radioDefault, radioMax));
    },
    [buscarEn, cambiar, filtros, radioDefault, radioMax],
  );

  return (
    <>
      <BuscarForm
        filtros={filtros}
        onCambio={cambiar}
        onBuscar={onBuscar}
        localidades={localidades}
        radioMax={radioMax}
        pendiente={pendiente}
      />
      <BuscarResultados
        params={hayResultado ? inicial : null}
        naps={naps}
        truncado={truncado}
        limite={limite}
        radio={radioDeFiltros(filtros, radioDefault, radioMax)}
        seleccionada={seleccionada}
        onSeleccionar={setSeleccionada}
        onMoverPunto={onMoverPunto}
      />
    </>
  );
}
