"use client";

import { NapMapLazy } from "@/features/naps/NapMapLazy";
import type { NapDetalle } from "@/lib/gis/schema";

/** Mapa compacto de una sola NAP para la página de detalle (wrapper cliente: los callbacks no pueden venir del servidor). */
export function NapMiniMapa({ nap }: { nap: NapDetalle }) {
  return (
    <NapMapLazy
      centro={{ lat: nap.lat, lon: nap.lon }}
      radio={100}
      naps={[{ ...nap, metros: 0 }]}
      seleccionada={nap.idNap}
      onSeleccionar={() => {}}
      compacto
    />
  );
}
