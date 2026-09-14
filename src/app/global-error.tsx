"use client";

/** Último recurso: falla el layout raíz. Debe traer su propio <html>/<body>, sin dependencias de la app. */
export default function ErrorGlobal({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es-AR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>NAPs CCC no está disponible</h1>
          <p style={{ color: "#555", fontSize: 14 }}>
            Ocurrió un error inesperado. Reintentá en unos segundos; si persiste, avisá a sistemas
            {error.digest ? ` indicando el código ${error.digest}` : ""}.
          </p>
          <button onClick={retry} style={{ marginTop: 12, padding: "8px 16px", cursor: "pointer" }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
