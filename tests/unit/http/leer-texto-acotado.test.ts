import { describe, expect, it } from "vitest";
import { RespuestaDemasiadoGrandeError, leerTextoAcotado } from "@/lib/http/leer-texto-acotado";

describe("leerTextoAcotado", () => {
  it("devuelve el texto cuando entra en el tope", async () => {
    expect(await leerTextoAcotado(new Response("hola"), 100)).toBe("hola");
  });

  it("rechaza por Content-Length antes de leer el cuerpo", async () => {
    const r = new Response("x".repeat(10), { headers: { "content-length": "999999" } });
    await expect(leerTextoAcotado(r, 100)).rejects.toBeInstanceOf(RespuestaDemasiadoGrandeError);
  });

  it("corta un stream sin Content-Length que supera el tope", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 10; i++) controller.enqueue(new TextEncoder().encode("a".repeat(1000)));
        controller.close();
      },
    });
    await expect(leerTextoAcotado(new Response(stream), 5000)).rejects.toBeInstanceOf(RespuestaDemasiadoGrandeError);
  });

  it("decodifica UTF-8 repartido en varios chunks", async () => {
    const bytes = new TextEncoder().encode("ñandú");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 2));
        controller.enqueue(bytes.slice(2));
        controller.close();
      },
    });
    expect(await leerTextoAcotado(new Response(stream), 100)).toBe("ñandú");
  });
});
