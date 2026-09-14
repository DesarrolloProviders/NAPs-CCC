"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Pantalla de error de la zona autenticada. Next no manda el mensaje real al navegador en producción;
 * `digest` es el código que aparece en los logs del servidor para encontrar la causa.
 */
export default function ErrorApp({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        No se pudo completar la operación. Reintentá; si el problema sigue, avisá a sistemas
        {error.digest ? (
          <>
            {" "}
            indicando el código <code className="rounded bg-muted px-1 py-0.5 text-xs">{error.digest}</code>
          </>
        ) : null}
        .
      </p>
      <Button onClick={retry}>Reintentar</Button>
    </div>
  );
}
