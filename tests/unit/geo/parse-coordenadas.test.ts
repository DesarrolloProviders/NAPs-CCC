import { describe, expect, it } from "vitest";
import { estaEnTucuman, formatoCoordenadas, parseCoordenadas } from "@/lib/geo/parse-coordenadas";

describe("parseCoordenadas", () => {
  it("acepta 'lat, lon' con punto decimal", () => {
    expect(parseCoordenadas("-26.8419, -65.1622")).toEqual({ lat: -26.8419, lon: -65.1622 });
  });

  it("acepta separador espacio y punto y coma", () => {
    expect(parseCoordenadas("-26.8419 -65.1622")).toEqual({ lat: -26.8419, lon: -65.1622 });
    expect(parseCoordenadas("-26.8419;-65.1622")).toEqual({ lat: -26.8419, lon: -65.1622 });
  });

  it("acepta coma decimal cuando el separador es espacio o ';'", () => {
    expect(parseCoordenadas("-26,8419 -65,1622")).toEqual({ lat: -26.8419, lon: -65.1622 });
    expect(parseCoordenadas("-26,8419; -65,1622")).toEqual({ lat: -26.8419, lon: -65.1622 });
  });

  it("extrae de una URL de Google Maps con @lat,lon", () => {
    const url = "https://www.google.com/maps/place/x/@-26.8419079,-65.1622185,17z/data=!3m1";
    expect(parseCoordenadas(url)).toEqual({ lat: -26.8419079, lon: -65.1622185 });
  });

  it("extrae de una URL con q=lat,lon", () => {
    expect(parseCoordenadas("https://www.google.com/maps?q=-26.84,-65.16")).toEqual({ lat: -26.84, lon: -65.16 });
  });

  it("extrae de una URL de OpenStreetMap con mlat/mlon", () => {
    expect(parseCoordenadas("https://www.openstreetmap.org/?mlat=-26.84&mlon=-65.16#map=17")).toEqual({
      lat: -26.84,
      lon: -65.16,
    });
  });

  it("rechaza texto vacío, basura y fuera de rango", () => {
    expect(parseCoordenadas("")).toBeNull();
    expect(parseCoordenadas("   ")).toBeNull();
    expect(parseCoordenadas("hola")).toBeNull();
    expect(parseCoordenadas("-26.84")).toBeNull();
    expect(parseCoordenadas("-126.84, -65.16")).toBeNull();
    expect(parseCoordenadas("-26.84, -265.16")).toBeNull();
  });

  it("tolera espacios alrededor", () => {
    expect(parseCoordenadas("  -26.8419 ,  -65.1622  ")).toEqual({ lat: -26.8419, lon: -65.1622 });
  });
});

describe("estaEnTucuman / formatoCoordenadas", () => {
  it("detecta el punto de prueba dentro de Tucumán", () => {
    expect(estaEnTucuman({ lat: -26.8419, lon: -65.1622 })).toBe(true);
    expect(estaEnTucuman({ lat: -34.6, lon: -58.4 })).toBe(false);
  });

  it("formatea con 6 decimales", () => {
    expect(formatoCoordenadas({ lat: -26.8419079653, lon: -65.1622185657 })).toBe("-26.841908, -65.162219");
  });
});
