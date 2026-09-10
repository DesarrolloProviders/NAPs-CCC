import "server-only";
import { estadoPuerto, type EstadoPuerto } from "@/features/puertos/estado-puerto";
import { instaladasRecientesPorIdNodos, reservasVigentesPorIdNodos, type ReservaVigente } from "@/features/reservas/repo";
import { getPuertosNap } from "@/lib/spi40/actions";
import { esSpi40Error, Spi40Error } from "@/lib/spi40/errors";
import type { OpcionesLlamada } from "@/lib/spi40/client";

/** Puerto de una NAP listo para mostrar: spi40 + reservas propias + (después) estado OLT. */
export interface PuertoVista {
  idNodo: number;
  puerto: number;
  cliente: { id: number; nombre: string | null } | null;
  macOnt: string | null;
  serialOnt: string | null;
  modeloOnt: string | null;
  /** Estado sin consultar la OLT (online se resuelve del lado cliente, diferido). */
  estado: EstadoPuerto;
  reserva: ReservaVigente | null;
  instaladoReciente: boolean;
}

export interface PuertosResultado {
  puertos: PuertoVista[];
  error: { kind: string; mensaje: string } | null;
  /** Cantidad de puertos libres según spi40 + reservas (disponibilidad real, no la de PostGIS). */
  libres: number;
}

/** Puertos de la NAP fusionados con nuestras reservas. Nunca lanza: si spi40 falla devuelve `error`. */
export async function obtenerPuertosConEstado(codigoNap: string, opciones?: OpcionesLlamada): Promise<PuertosResultado> {
  let registros;
  try {
    registros = await getPuertosNap(codigoNap, opciones);
  } catch (e) {
    const err = esSpi40Error(e) ? e : new Spi40Error("network", 22024, String(e));
    return { puertos: [], error: { kind: err.kind, mensaje: err.toUserMessage() }, libres: 0 };
  }

  const idNodos = registros.map((r) => r.id_nodo).filter((n): n is number => n !== null);
  const [vigentes, instaladas] = await Promise.all([reservasVigentesPorIdNodos(idNodos), instaladasRecientesPorIdNodos(idNodos)]);

  const puertos: PuertoVista[] = registros
    .filter((r) => r.id_nodo !== null && r.puerto !== null)
    .map((r) => {
      const idNodo = r.id_nodo!;
      const reserva = vigentes.get(idNodo) ?? null;
      const instaladoReciente = instaladas.has(idNodo);
      const estado = estadoPuerto({
        macOnt: r.mac_ont,
        idCliente: r.id_cli,
        online: null,
        reservaVigente: reserva !== null,
        instaladoReciente,
      });
      return {
        idNodo,
        puerto: r.puerto!,
        cliente: r.id_cli && r.id_cli > 0 ? { id: r.id_cli, nombre: r.denominacion_cli } : null,
        macOnt: r.mac_ont,
        serialOnt: r.serial_ont,
        modeloOnt: r.modelo_ont,
        estado,
        reserva,
        instaladoReciente,
      };
    });

  return { puertos, error: null, libres: puertos.filter((p) => p.estado === "libre").length };
}
