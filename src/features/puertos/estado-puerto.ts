/**
 * Regla de negocio del estado de un puerto de NAP (función pura, sin IO).
 * Tomada del legacy (online_ff.php:387-407); la app es de solo consulta, así que el estado
 * sale enteramente de los sistemas de origen (spi40 + OLT):
 *
 *   online > ocupado > libre
 *
 *  - online:  la OLT confirma la ONT en línea.
 *  - ocupado: spi40 informa una MAC de ONT (o un cliente) pero la OLT no confirma (o no se consultó).
 *  - libre:   sin MAC y sin cliente.
 */
export type EstadoPuerto = "libre" | "ocupado" | "online";

export interface EntradaEstado {
  macOnt: string | null;
  idCliente: number | null;
  /** true / false según OLT; null = no consultado o sin dato. */
  online: boolean | null;
}

export function estadoPuerto(e: EntradaEstado): EstadoPuerto {
  const tieneOnt = Boolean(e.macOnt) || Boolean(e.idCliente && e.idCliente > 0);
  if (tieneOnt && e.online === true) return "online";
  if (tieneOnt) return "ocupado";
  return "libre";
}

export const ETIQUETA_ESTADO: Record<EstadoPuerto, string> = {
  libre: "Libre",
  ocupado: "Ocupado",
  online: "Online",
};
