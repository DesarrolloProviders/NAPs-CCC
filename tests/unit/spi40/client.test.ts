import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// env.ts se valida al importarse: fijamos variables mínimas antes de cargar el cliente.
beforeAll(() => {
  Object.assign(process.env, {
    APP_DATABASE_URL: "postgres://u:p@localhost:5440/x",
    GIS_DATABASE_URL: "postgres://u:p@localhost:5441/x",
    SPI40_BASE_URL: "http://spi40.test/ws.php",
    SPI40_TIMEOUT_MS: "200",
    SPI40_CACHE_TTL_MS: "1000",
    OLT_BASE_URL: "http://olt.test/tools.php",
    BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
    BETTER_AUTH_URL: "http://localhost:3110",
    ADMIN_SEED_EMAIL: "a@b.co",
    ADMIN_SEED_PASSWORD: "0123456789",
    CRON_SECRET: "12345678",
    LOG_LEVEL: "silent",
  });
});

function respuestaB64(sobre: unknown, init: ResponseInit = {}): Response {
  return new Response(Buffer.from(JSON.stringify(sobre), "utf8").toString("base64"), { status: 200, ...init });
}

const SOBRE_OK = [{ result_ok: true, errors: "", records: [{ id_nodo: "1", puerto: "1", mac_ont: "" }] }];

describe("llamarSpi40 / consultarSpi40", () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    const { limpiarCacheSpi40 } = await import("@/lib/spi40/client");
    limpiarCacheSpi40();
  });

  it("construye la URL con base64 urlencoded y devuelve records validados", async () => {
    const fetchMock = vi.fn(async () => respuestaB64(SOBRE_OK));
    vi.stubGlobal("fetch", fetchMock);
    const { consultarSpi40 } = await import("@/lib/spi40/client");
    const { puertoNapSchema } = await import("@/lib/spi40/schemas");

    const { records } = await consultarSpi40(22024, { descripcion: "303-01-08-N08-1-E" }, puertoNapSchema);
    expect(records).toHaveLength(1);
    expect(records[0]?.id_nodo).toBe(1);

    const url = String((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url.startsWith("http://spi40.test/ws.php?request=")).toBe(true);
    const b64 = decodeURIComponent(url.split("request=")[1]!);
    expect(JSON.parse(Buffer.from(b64, "base64").toString("utf8"))).toEqual([
      { id_action: 22024, operador_ws: 1, descripcion: "303-01-08-N08-1-E" },
    ]);
  });

  it("usa la caché para la misma consulta y la evita con usarCache=false", async () => {
    const fetchMock = vi.fn(async () => respuestaB64(SOBRE_OK));
    vi.stubGlobal("fetch", fetchMock);
    const { llamarSpi40 } = await import("@/lib/spi40/client");
    await llamarSpi40(22024, { descripcion: "A" });
    await llamarSpi40(22024, { descripcion: "A" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await llamarSpi40(22024, { descripcion: "A" }, { usarCache: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reintenta una vez ante error de red y luego falla clasificado", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { llamarSpi40 } = await import("@/lib/spi40/client");
    const { Spi40Error } = await import("@/lib/spi40/errors");
    await expect(llamarSpi40(22024, { descripcion: "B" })).rejects.toBeInstanceOf(Spi40Error);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clasifica timeout y reintenta", async () => {
    const fetchMock = vi.fn(async () => {
      const e = new Error("aborted");
      e.name = "TimeoutError";
      throw e;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { llamarSpi40 } = await import("@/lib/spi40/client");
    await expect(llamarSpi40(22024, { descripcion: "C" })).rejects.toMatchObject({ kind: "timeout" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no reintenta cuando el webservice responde result_ok=false", async () => {
    const fetchMock = vi.fn(async () => respuestaB64([{ result_ok: false, errors: [{ property: "descripcion", message: "no existe" }], records: [] }]));
    vi.stubGlobal("fetch", fetchMock);
    const { llamarSpi40 } = await import("@/lib/spi40/client");
    await expect(llamarSpi40(22024, { descripcion: "D" })).rejects.toMatchObject({ kind: "ws_error" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clasifica HTTP 500 y respuestas no decodificables", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("error", { status: 500 })));
    const { llamarSpi40 } = await import("@/lib/spi40/client");
    await expect(llamarSpi40(22024, { descripcion: "E" })).rejects.toMatchObject({ kind: "http" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>login</html>", { status: 200 })));
    await expect(llamarSpi40(22024, { descripcion: "F" })).rejects.toMatchObject({ kind: "decode" });
  });
});
