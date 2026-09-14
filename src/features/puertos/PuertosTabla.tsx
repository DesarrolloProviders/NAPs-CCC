"use client";

import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EstadoOnlineCell } from "@/features/puertos/EstadoOnlineCell";
import { ETIQUETA_ESTADO, type EstadoPuerto } from "@/features/puertos/estado-puerto";
import type { PuertoVista } from "@/features/puertos/fusionar-puertos";
import { fetchEstadoOlt, useOltStatus } from "@/features/puertos/use-olt-status";
import { cn } from "@/lib/utils";

const CLASE_ESTADO: Record<EstadoPuerto, string> = {
  libre: "border-green-200 bg-green-100 text-green-800",
  ocupado: "border-amber-200 bg-amber-100 text-amber-800",
  online: "border-green-200 bg-green-100 text-green-800",
};

interface Props {
  idNap: string;
  puertos: PuertoVista[];
}

export function PuertosTabla({ idNap, puertos }: Props) {
  const hayOnts = puertos.some((p) => p.macOnt);
  const olt = useOltStatus(idNap, hayOnts);
  const qc = useQueryClient();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {hayOnts
            ? olt.isPending
              ? "Consultando estado en la OLT (puede tardar hasta un minuto)…"
              : olt.isError
                ? `No se pudo consultar la OLT: ${olt.error.message}`
                : `Estado OLT consultado (${olt.data?.consultadas ?? 0} ONT${(olt.data?.consultadas ?? 0) === 1 ? "" : "s"}).`
            : "Ningún puerto tiene ONT asignada."}
        </p>
        {hayOnts ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={olt.isFetching}
            onClick={() =>
              qc
                .fetchQuery({ queryKey: ["olt", idNap], queryFn: ({ signal }) => fetchEstadoOlt(idNap, { refresh: true, signal }), staleTime: 0 })
                .then((r) => {
                  if (r.throttled) toast.info("El estado OLT de esta NAP se actualizó hace menos de un minuto; se muestra el último consultado.");
                })
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo consultar la OLT"))
            }
            title="Volver a consultar la OLT"
          >
            <RefreshCw className={cn("size-4", olt.isFetching && "animate-spin")} aria-hidden />
            <span className="sr-only">Actualizar estado OLT</span>
          </Button>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Puerto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>ONT</TableHead>
            <TableHead>OLT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {puertos.map((p) => {
            const estadoOlt = p.macOnt ? olt.data?.estados?.[p.macOnt] : undefined;
            const estadoFinal: EstadoPuerto = p.estado === "ocupado" && estadoOlt?.online === true ? "online" : p.estado;
            return (
              <TableRow key={p.idNodo} data-testid={`puerto-${p.puerto}`} data-estado={estadoFinal}>
                <TableCell className="font-medium tabular-nums">{p.puerto}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("w-fit text-[11px]", CLASE_ESTADO[estadoFinal])}>
                    {ETIQUETA_ESTADO[estadoFinal]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {p.cliente ? (
                    <div className="flex flex-col">
                      <span>{p.cliente.nombre ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">ID {p.cliente.id}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {p.macOnt ? (
                    <div className="flex flex-col">
                      <span className="font-mono text-xs">{p.macOnt}</span>
                      <span className="text-xs text-muted-foreground">{p.modeloOnt ?? p.serialOnt ?? ""}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <EstadoOnlineCell mac={p.macOnt} estado={estadoOlt} cargando={olt.isPending} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
