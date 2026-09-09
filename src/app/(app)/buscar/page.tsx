import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buscar NAPs" };

// Placeholder de la Fase 3; la Fase 4 reemplaza esta página por la búsqueda con mapa.
export default function BuscarPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Buscar NAPs</h1>
      <p className="text-muted-foreground">La búsqueda por coordenadas y radio se habilita en la siguiente fase.</p>
    </div>
  );
}
