/**
 * Regla de negocio del estado de un puerto de NAP (función pura, sin IO).
 * Tomada del legacy (online_ff.php:387-407) y extendida con "instalado" (reserva confirmada por técnica):
 *
 *   reservado  > instalado > online > ocupado > libre
 *
 *  - reservado: existe una reserva vigente (nuestra base) para el id_nodo.
 *  - instalado: una reserva pasó a "instalada" y el puerto todavía no figura con MAC en spi40 (transitorio).
 *  - online:    la OLT confirma la ONT en línea.
 *  - ocupado:   spi40 informa una MAC de ONT (o un cliente) pero la OLT no confirma (o no se consultó).
 *  - libre:     sin MAC y sin cliente.
 */
export type EstadoPuerto = "libre" | "reservado" | "instalado" | "ocupado" | "online";

export interface EntradaEstado {
  macOnt: string | null;
  idCliente: number | null;
  /** true / false según OLT; null = no consultado o sin dato. */
  online: boolean | null;
  reservaVigente: boolean;
  instaladoReciente: boolean;
}

export function estadoPuerto(e: EntradaEstado): EstadoPuerto {
  const tieneOnt = Boolean(e.macOnt) || Boolean(e.idCliente && e.idCliente > 0);
  if (e.reservaVigente) return "reservado";
  if (!tieneOnt && e.instaladoReciente) return "instalado";
  if (tieneOnt && e.online === true) return "online";
  if (tieneOnt) return "ocupado";
  return "libre";
}

/** Un puerto se puede reservar solo si está libre. */
export function sePuedeReservar(estado: EstadoPuerto): boolean {
  return estado === "libre";
}

/** Se puede "instalar" (confirmar con nro de abonado) un puerto reservado o libre. */
export function sePuedeInstalar(estado: EstadoPuerto): boolean {
  return estado === "reservado" || estado === "libre";
}

export const ETIQUETA_ESTADO: Record<EstadoPuerto, string> = {
  libre: "Libre",
  reservado: "Reservado",
  instalado: "Instalado",
  ocupado: "Ocupado",
  online: "Online",
};
