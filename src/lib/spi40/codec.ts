/**
 * Codec del transporte de spi40: el request es un array JSON de un objeto, en base64, dentro del query string;
 * la respuesta es base64 de un JSON.
 *
 * El legacy pegaba el base64 crudo en la URL y fallaba cuando aparecía '+', '/' o '='.
 * Acá se aplica encodeURIComponent: PHP hace urldecode de $_GET y recibe el base64 intacto.
 */

export function codificarRequest(payload: Record<string, unknown>): string {
  const json = JSON.stringify([payload]);
  const base64 = Buffer.from(json, "utf8").toString("base64");
  return encodeURIComponent(base64);
}

export function construirUrl(baseUrl: string, payload: Record<string, unknown>): string {
  const separador = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separador}request=${codificarRequest(payload)}`;
}

export class DecodeError extends Error {
  constructor(mensaje: string, readonly muestra: string) {
    super(mensaje);
    this.name = "DecodeError";
  }
}

const BASE64_REGEX = /^[A-Za-z0-9+/=\s]+$/;

/**
 * Decodifica la respuesta base64 → JSON. Si el JSON no parsea en UTF-8 (o trae caracteres de reemplazo),
 * reintenta interpretando los bytes como latin1 (PHP puede responder en ISO-8859-1).
 */
export function decodificarRespuesta(texto: string): unknown {
  const limpio = texto.trim();
  if (!limpio) throw new DecodeError("Respuesta vacía del webservice", "");
  if (!BASE64_REGEX.test(limpio)) {
    throw new DecodeError("La respuesta no es base64", limpio.slice(0, 120));
  }
  const bytes = Buffer.from(limpio, "base64");
  if (bytes.length === 0) throw new DecodeError("Base64 vacío o inválido", limpio.slice(0, 120));

  const utf8 = bytes.toString("utf8");
  try {
    if (!utf8.includes("�")) return repararMojibakeProfundo(JSON.parse(utf8));
  } catch {
    // cae al intento latin1
  }
  const latin1 = bytes.toString("latin1");
  try {
    return repararMojibakeProfundo(JSON.parse(latin1));
  } catch (e) {
    throw new DecodeError(`JSON inválido: ${(e as Error).message}`, latin1.slice(0, 120));
  }
}

// El PHP de spi40 a veces codifica dos veces: "Sebastián" llega como "SebastiÃ¡n". Se detecta por las secuencias
// típicas (Ã + carácter latin1) y se revierte reinterpretando los bytes.
const MOJIBAKE_REGEX = /Ã[-¿]|Â[-¿]/;

export function repararMojibake(s: string): string {
  if (!MOJIBAKE_REGEX.test(s)) return s;
  const arreglado = Buffer.from(s, "latin1").toString("utf8");
  return arreglado.includes("�") ? s : arreglado;
}

export function repararMojibakeProfundo<T>(valor: T): T {
  if (typeof valor === "string") return repararMojibake(valor) as T;
  if (Array.isArray(valor)) return valor.map(repararMojibakeProfundo) as T;
  if (valor && typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) salida[k] = repararMojibakeProfundo(v);
    return salida as T;
  }
  return valor;
}
