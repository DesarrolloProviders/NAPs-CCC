import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NoEncontrado() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <p className="max-w-md text-sm text-muted-foreground">La dirección no existe o cambió.</p>
      <Button nativeButton={false} render={<Link href="/buscar" />}>
        Ir a la búsqueda
      </Button>
    </main>
  );
}
