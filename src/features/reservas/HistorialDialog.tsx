"use client";

import { History } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { obtenerHistorialPuerto, type HistorialItem } from "@/features/reservas/actions";
import { formatoCorto, formatoFechaHora } from "@/lib/fechas";

const ETIQUETA: Record<string, string> = {
  activa: "Activa",
  vencida: "Vencida",
  liberada: "Liberada",
  instalada: "Instalada",
  creada: "creada",
  importada: "importada",
};

export function HistorialDialog({ idNodo, puerto }: { idNodo: number; puerto: number }) {
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<HistorialItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onOpenChange(v: boolean) {
    setAbierto(v);
    if (v && items === null) {
      const r = await obtenerHistorialPuerto(idNodo);
      if (r.ok) setItems(r.data);
      else setError(r.mensaje);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="ghost" title="Historial del puerto" data-testid={`historial-${puerto}`} />}>
        <History className="size-4" aria-hidden />
        <span className="sr-only">Historial</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial del puerto {puerto}</DialogTitle>
          <DialogDescription>Reservas, liberaciones e instalaciones registradas en este sistema.</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {items === null && !error ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
        {items && items.length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p> : null}
        {items && items.length > 0 ? (
          <ol className="max-h-96 space-y-3 overflow-y-auto text-sm">
            {items.map((r) => (
              <li key={r.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{ETIQUETA[r.estado] ?? r.estado}</Badge>
                  <span className="text-xs text-muted-foreground">{formatoFechaHora(new Date(r.creadaEn))}</span>
                </div>
                <div className="mt-1">{r.observacion}</div>
                <div className="text-xs text-muted-foreground">
                  Vence {formatoCorto(r.venceEn)}
                  {r.creadaPor ? ` · por ${r.creadaPor}` : ""}
                  {r.nroAbonado ? ` · abonado ${r.nroAbonado}` : ""}
                  {r.origen === "legacy_import" ? " · importada del sistema anterior" : ""}
                </div>
                {r.eventos.length ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {r.eventos.map((e, i) => (
                      <li key={i}>
                        {ETIQUETA[e.tipo] ?? e.tipo} · {formatoFechaHora(new Date(e.creadoEn))}
                        {e.actor ? ` · ${e.actor}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
