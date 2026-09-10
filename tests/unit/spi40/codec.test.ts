import { describe, expect, it } from "vitest";
import { DecodeError, codificarRequest, construirUrl, decodificarRespuesta } from "@/lib/spi40/codec";

describe("codificarRequest / construirUrl", () => {
  it("envuelve el payload en un array, base64 y encodeURIComponent", () => {
    const payload = { id_action: 22024, operador_ws: 1, descripcion: "303-01-08-N08-1-E" };
    const codificado = codificarRequest(payload);
    const base64 = decodeURIComponent(codificado);
    expect(JSON.parse(Buffer.from(base64, "base64").toString("utf8"))).toEqual([payload]);
  });

  it("escapa '+', '/' y '=' que aparecen en el base64 (el legacy fallaba con esto)", () => {
    // 'ñ' y '?' generan bytes que producen '+' y '/' en base64 con alta probabilidad; forzamos varios.
    const payload = { id_action: 22015, operador_ws: 1, descripcion: "Ñandú ??>>??>>~~~" };
    const codificado = codificarRequest(payload);
    expect(codificado).not.toMatch(/[+/=]/);
    const base64 = decodeURIComponent(codificado);
    expect(base64).toMatch(/[+/=]/);
    expect(JSON.parse(Buffer.from(base64, "base64").toString("utf8"))).toEqual([payload]);
  });

  it("arma la URL con ? o & según corresponda", () => {
    expect(construirUrl("http://h/ws.php", { a: 1 })).toMatch(/^http:\/\/h\/ws\.php\?request=/);
    expect(construirUrl("http://h/ws.php?x=1", { a: 1 })).toMatch(/^http:\/\/h\/ws\.php\?x=1&request=/);
  });
});

describe("decodificarRespuesta", () => {
  const sobre = [{ result_ok: true, errors: "", records: [{ puerto: "1", denominacion_cli: "Pérez, José" }] }];

  it("decodifica base64 UTF-8", () => {
    const b64 = Buffer.from(JSON.stringify(sobre), "utf8").toString("base64");
    expect(decodificarRespuesta(b64)).toEqual(sobre);
  });

  it("tolera saltos de línea y espacios alrededor", () => {
    const b64 = Buffer.from(JSON.stringify(sobre), "utf8").toString("base64");
    expect(decodificarRespuesta(`\n  ${b64}\n`)).toEqual(sobre);
  });

  it("cae a latin1 si el servidor respondió en ISO-8859-1", () => {
    const b64 = Buffer.from(JSON.stringify(sobre), "latin1").toString("base64");
    expect(decodificarRespuesta(b64)).toEqual(sobre);
  });

  it("repara nombres con doble codificación (mojibake) sin tocar los correctos", () => {
    const conMojibake = [{ result_ok: true, records: [{ denominacion_cli: "Frias, Pedro SebastiÃ¡n", otro: "Ñandú correcto", n: 3 }] }];
    const b64 = Buffer.from(JSON.stringify(conMojibake), "utf8").toString("base64");
    const r = decodificarRespuesta(b64) as typeof conMojibake;
    expect(r[0]?.records[0]?.denominacion_cli).toBe("Frias, Pedro Sebastián");
    expect(r[0]?.records[0]?.otro).toBe("Ñandú correcto");
    expect(r[0]?.records[0]?.n).toBe(3);
  });

  it("lanza DecodeError ante vacío, no-base64 o JSON inválido", () => {
    expect(() => decodificarRespuesta("")).toThrow(DecodeError);
    expect(() => decodificarRespuesta("<html>error</html>")).toThrow(DecodeError);
    expect(() => decodificarRespuesta(Buffer.from("no es json").toString("base64"))).toThrow(DecodeError);
  });
});
