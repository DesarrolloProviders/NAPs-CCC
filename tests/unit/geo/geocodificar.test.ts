import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  construirConsulta,
  geocodificar,
  GeocodificadorError,
  limpiarCacheGeocodificador,
  pareceDireccion,
  precisionDe,
} from "@/lib/geo/geocodificar";

/** Respuesta real de Nominatim para "Cordoba 1083, San Miguel de Tucuman" (recortada). */
const CASA = {
  lat: "-26.8250347",
  lon: "-65.2125379",
  place_rank: 30,
  display_name: "1083, Córdoba, Centro, San Miguel de Tucumán, Departamento Capital, Tucumán, T4000, Argentina",
};

/** Cuando no hay altura cargada, Nominatim devuelve el eje de la calle (place_rank 26). */
const CALLE = {
  lat: "-26.8107032",
  lon: "-65.3080610",
  place_rank: 26,
  display_name: "Avenida Aconquija, Marcos Paz, Yerba Buena, Departamento Yerba Buena, Tucumán, T4107, Argentina",
};

function responderCon(cuerpo: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fetchFalso = vi.fn(async (url: string | URL) => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => cuerpo,
    url: String(url),
  }));
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

describe("pareceDireccion", () => {
  it("distingue texto de números sueltos", () => {
    expect(pareceDireccion("Córdoba 1083")).toBe(true);
    expect(pareceDireccion("-26.8419, -65.1622")).toBe(false);
    expect(pareceDireccion("1083")).toBe(false);
  });
});

describe("construirConsulta", () => {
  it("agrega localidad, provincia y país", () => {
    expect(construirConsulta("Córdoba 1083", "San Miguel de Tucuman")).toBe("Córdoba 1083, San Miguel de Tucuman, Tucumán, Argentina");
  });

  it("no duplica lo que el usuario ya escribió (sin importar tildes ni mayúsculas)", () => {
    expect(construirConsulta("Córdoba 1083, san miguel de tucuman", "San Miguel de Tucuman")).toBe(
      "Córdoba 1083, san miguel de tucuman, Argentina",
    );
    expect(construirConsulta("Laprida 250, Tucumán, Argentina")).toBe("Laprida 250, Tucumán, Argentina");
  });

  it("sin localidad elegida deja el texto tal cual y completa provincia y país", () => {
    expect(construirConsulta("  Laprida   250 ", null)).toBe("Laprida 250, Tucumán, Argentina");
  });
});

describe("precisionDe", () => {
  it("mapea el place_rank de Nominatim", () => {
    expect(precisionDe(30)).toBe("exacta");
    expect(precisionDe(26)).toBe("calle");
    expect(precisionDe(19)).toBe("aproximada");
    expect(precisionDe(undefined)).toBe("aproximada");
  });
});

describe("geocodificar", () => {
  beforeEach(() => {
    limpiarCacheGeocodificador();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve coordenadas, etiqueta y precisión de la mejor coincidencia", async () => {
    const fetchFalso = responderCon([CASA]);
    const r = await geocodificar("Córdoba 1083", { localidad: "San Miguel de Tucuman" });
    expect(r).toEqual({
      coord: { lat: -26.8250347, lon: -65.2125379 },
      etiqueta: CASA.display_name,
      precision: "exacta",
    });
    const url = String(fetchFalso.mock.calls[0]?.[0]);
    expect(url).toContain("q=C%C3%B3rdoba+1083%2C+San+Miguel+de+Tucuman%2C+Tucum%C3%A1n%2C+Argentina");
    // Acotado a Tucumán y a Argentina: no debe traer una calle homónima de otra provincia.
    expect(url).toContain("countrycodes=ar");
    expect(url).toContain("bounded=1");
    expect(url).toContain("viewbox=-66.3%2C-28.2%2C-64.4%2C-26");
  });

  it("marca como 'calle' el resultado sin altura", async () => {
    responderCon([CALLE]);
    const r = await geocodificar("Av Aconquija 1800", { localidad: "Yerba Buena" });
    expect(r?.precision).toBe("calle");
  });

  it("devuelve null si no hay coincidencias", async () => {
    responderCon([]);
    await expect(geocodificar("Calle que no existe 123")).resolves.toBeNull();
  });

  it("cachea por consulta: no repite el pedido", async () => {
    const fetchFalso = responderCon([CASA]);
    await geocodificar("Córdoba 1083", { localidad: "San Miguel de Tucuman" });
    await geocodificar("  Córdoba 1083 ", { localidad: "San Miguel de Tucuman" });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("convierte el error de red en un mensaje accionable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(geocodificar("Córdoba 1083")).rejects.toBeInstanceOf(GeocodificadorError);
  });

  it("falla con mensaje claro si el servicio responde con error HTTP", async () => {
    responderCon([], { ok: false, status: 429 });
    await expect(geocodificar("Córdoba 1083")).rejects.toThrow(/429/);
  });
});
