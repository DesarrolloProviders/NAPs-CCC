import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NapNoEncontrada() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold">NAP no encontrada</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        No hay una NAP con ese código en la base de QGIS. Verificá el código (por ejemplo 303-01-08-N08-1-E) o buscala por coordenadas.
      </p>
      <Button nativeButton={false} render={<Link href="/buscar" />}>Ir a la búsqueda</Button>
    </div>
  );
}
