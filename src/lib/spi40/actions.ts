import "server-only";
import { consultarSpi40, type OpcionesLlamada } from "@/lib/spi40/client";
import {
  ID_ACTION,
  napDisponibleSchema,
  ontClienteSchema,
  puertoNapSchema,
  type NapDisponibleWs,
  type OntClienteWs,
  type PuertoNapWs,
} from "@/lib/spi40/schemas";

/**
 * Acciones de spi40 usadas por la app. A spi40 se le manda el código de NAP tal como está en PostGIS (con trim),
 * no el normalizado, porque no sabemos si tolera diferencias de formato.
 */

/** 22024: puertos de una NAP con cliente y ONT. Ordenados por número de puerto. */
export async function getPuertosNap(codigoNap: string, opciones?: OpcionesLlamada): Promise<PuertoNapWs[]> {
  const { records } = await consultarSpi40(ID_ACTION.PUERTOS_NAP, { descripcion: codigoNap.trim() }, puertoNapSchema, opciones);
  return records.sort((a, b) => (a.puerto ?? 0) - (b.puerto ?? 0));
}

/** 22002: ONT/cliente por MAC. */
export async function getOntPorMac(mac: string, opciones?: OpcionesLlamada): Promise<OntClienteWs[]> {
  const { records } = await consultarSpi40(ID_ACTION.ONT_CLIENTE, { mac: mac.trim() }, ontClienteSchema, opciones);
  return records;
}

/** 22002: ONT/cliente por id de cliente. */
export async function getClientePorId(idCliente: number, opciones?: OpcionesLlamada): Promise<OntClienteWs[]> {
  const { records } = await consultarSpi40(ID_ACTION.ONT_CLIENTE, { id_cliente: idCliente }, ontClienteSchema, opciones);
  return records;
}

/** 22015: NAPs/splitters con disponibles. `descripcion` vacía = todas (respuesta grande). */
export async function getNapsDisponibles(descripcion = "", opciones?: OpcionesLlamada): Promise<NapDisponibleWs[]> {
  const { records } = await consultarSpi40(ID_ACTION.NAPS_DISPONIBLES, { descripcion }, napDisponibleSchema, {
    timeoutMs: 30000,
    ...opciones,
  });
  return records;
}
