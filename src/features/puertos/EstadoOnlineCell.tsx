"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type EstadoOlt = { online: boolean | null; status: number | null; detalle: Record<string, string | number | boolean | null> } | undefined;

/** Muestra el estado de la OLT para una MAC: cargando / online / offline / sin dato. */
export function EstadoOnlineCell({ mac, estado, cargando }: { mac: string | null; estado: EstadoOlt; cargando: boolean }) {
  if (!mac) return <span className="text-muted-foreground">—</span>;
  if (cargando && !estado) return <span className="animate-pulse text-xs text-muted-foreground">consultando…</span>;
  if (!estado || estado.online === null) return <span className="text-xs text-muted-foreground">sin dato</span>;

  const rx = estado.detalle.RxPower;
  const rxDbm = typeof rx === "string" || typeof rx === "number" ? Number(rx) / 100 : null;
  const distancia = estado.detalle.distance;
  const badge = (
    <Badge variant="outline" className={cn("text-[11px]", estado.online ? "border-green-200 bg-green-100 text-green-800" : "border-red-200 bg-red-100 text-red-800")}>
      {estado.online ? "Online" : "Offline"}
    </Badge>
  );
  if (!estado.online) return badge;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex cursor-help" />}>{badge}</TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5 text-xs">
          {rxDbm !== null && Number.isFinite(rxDbm) ? <div>Rx: {rxDbm.toFixed(2)} dBm</div> : null}
          {distancia ? <div>Distancia: {distancia} m</div> : null}
          {estado.detalle.port ? <div>Puerto OLT: {String(estado.detalle.port)}</div> : null}
          {estado.detalle.ontip ? <div>IP: {String(estado.detalle.ontip)}</div> : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
