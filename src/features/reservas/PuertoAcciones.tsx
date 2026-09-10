"use client";

import { HistorialDialog } from "@/features/reservas/HistorialDialog";
import { InstalarDialog } from "@/features/reservas/InstalarDialog";
import { LiberarDialog } from "@/features/reservas/LiberarDialog";
import { ReservarDialog } from "@/features/reservas/ReservarDialog";
import { sePuedeInstalar, sePuedeReservar } from "@/features/puertos/estado-puerto";
import type { PuertoVista } from "@/features/puertos/fusionar-puertos";
import { puede, type Rol } from "@/lib/auth/permissions";

interface Props {
  idNap: string;
  puerto: PuertoVista;
  rol: Rol;
  diasDefault: number;
  diasMax: number;
}

/** Botones por puerto según el rol (la autorización real la hace el servidor). */
export function PuertoAcciones({ idNap, puerto: p, rol, diasDefault, diasMax }: Props) {
  return (
    <div className="flex justify-end gap-1">
      {puede(rol, "reservar") && sePuedeReservar(p.estado) ? (
        <ReservarDialog idNap={idNap} idNodo={p.idNodo} puerto={p.puerto} diasDefault={diasDefault} diasMax={diasMax} />
      ) : null}
      {puede(rol, "liberar") && p.reserva ? (
        <LiberarDialog idNap={idNap} reservaId={p.reserva.id} puerto={p.puerto} observacion={p.reserva.observacion} />
      ) : null}
      {puede(rol, "instalar") && sePuedeInstalar(p.estado) ? (
        <InstalarDialog idNap={idNap} idNodo={p.idNodo} puerto={p.puerto} reservaObservacion={p.reserva?.observacion ?? null} />
      ) : null}
      <HistorialDialog idNodo={p.idNodo} puerto={p.puerto} />
    </div>
  );
}
