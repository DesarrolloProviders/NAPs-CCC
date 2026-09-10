"use client";

import { Suspense, lazy, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { NapMapProps } from "@/features/naps/NapMap";

// Leaflet usa `window`: el mapa se importa recién cuando el componente está montado en el cliente.
const NapMap = lazy(() => import("@/features/naps/NapMap"));

function Cargando() {
  return <Skeleton className="h-full min-h-[420px] w-full rounded-none" aria-label="Cargando mapa" />;
}

export function NapMapLazy(props: NapMapProps) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return <Cargando />;
  return (
    <Suspense fallback={<Cargando />}>
      <NapMap {...props} />
    </Suspense>
  );
}
