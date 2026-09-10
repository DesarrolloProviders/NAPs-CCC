"use client";

import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EstadoOnlineCell } from "@/features/puertos/EstadoOnlineCell";
import { ETIQUETA_ESTADO, type EstadoPuerto } from "@/features/puertos/estado-puerto";
import type { PuertoVista } from "@/features/puertos/fusionar-puertos";
import { useOltStatus } from "@/features/puertos/use-olt-status";
import { PuertoAcciones } from "@/features/reservas/PuertoAcciones";
import type { Rol } from "@/lib/auth/permissions";
import { formatoCorto } from "@/lib/fechas";
import { cn } from "@/lib/utils";

const CLASE_ESTADO: Record<EstadoPuerto, string> = {
  libre: "border-green-200 bg-green-100 text-green-800",
  reservado: "border-blue-200 bg-blue-100 text-blue-800",
  instalado: "border-violet-200 bg-violet-100 text-violet-800",
  ocupado: "border-amber-200 bg-amber-100 text-amber-800",
  online: "border-green-200 bg-green-100 text-green-800",
};

interface Props {
  idNap: string;
  puertos: PuertoVista[];
  /** Rol del usuario: define qué acciones se muestran por puerto (la autorización real es del servidor). */
  rol: Rol;
  diasDefault: number;
  diasMax: number;
}

export function PuertosTabla({ idNap, puertos, rol, diasDefault, diasMax }: Props) {
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
            onClick={() => qc.fetchQuery({ queryKey: ["olt", idNap], queryFn: () => fetch(`/api/naps/${encodeURIComponent(idNap)}/olt?refresh=1`).then((r) => r.json()) })}
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
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {puertos.map((p) => {
            const estadoOlt = p.macOnt ? olt.data?.estados[p.macOnt] : undefined;
            const estadoFinal: EstadoPuerto = p.estado === "ocupado" && estadoOlt?.online === true ? "online" : p.estado;
            return (
              <TableRow key={p.idNodo} data-testid={`puerto-${p.puerto}`} data-estado={estadoFinal}>
                <TableCell className="font-medium tabular-nums">{p.puerto}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <Badge variant="outline" className={cn("w-fit text-[11px]", CLASE_ESTADO[estadoFinal])}>
                      {ETIQUETA_ESTADO[estadoFinal]}
                    </Badge>
                    {p.reserva ? (
                      <span className="text-xs text-muted-foreground">
                        hasta {formatoCorto(p.reserva.venceEn)}
                        {p.reserva.creadaPor ? ` por ${p.reserva.creadaPor.nombre}` : ""} · {p.reserva.observacion}
                      </span>
                    ) : null}
                  </div>
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
                <TableCell className="text-right">
                  <PuertoAcciones idNap={idNap} puerto={p} rol={rol} diasDefault={diasDefault} diasMax={diasMax} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
