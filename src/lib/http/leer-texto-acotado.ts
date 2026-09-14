/** La respuesta supera el tope permitido. */
export class RespuestaDemasiadoGrandeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`La respuesta supera el máximo permitido de ${maxBytes} bytes`);
    this.name = "RespuestaDemasiadoGrandeError";
  }
}

/**
 * Lee el cuerpo de una respuesta como texto con un tope de bytes: un servicio externo caído o
 * comprometido no debe poder agotar la memoria del proceso. Corta por Content-Length si viene,
 * y si no, acumulando el stream hasta el tope.
 */
export async function leerTextoAcotado(respuesta: Response, maxBytes: number): Promise<string> {
  const declarado = Number(respuesta.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > maxBytes) throw new RespuestaDemasiadoGrandeError(maxBytes);
  if (!respuesta.body) return respuesta.text();

  const lector = respuesta.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await lector.cancel().catch(() => undefined);
      throw new RespuestaDemasiadoGrandeError(maxBytes);
    }
    partes.push(value);
  }
  return new TextDecoder("utf-8").decode(concatenar(partes, total));
}

function concatenar(partes: Uint8Array[], total: number): Uint8Array {
  const salida = new Uint8Array(total);
  let offset = 0;
  for (const p of partes) {
    salida.set(p, offset);
    offset += p.byteLength;
  }
  return salida;
}
