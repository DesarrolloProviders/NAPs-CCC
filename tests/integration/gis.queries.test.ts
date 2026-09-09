import { afterAll, describe, expect, it } from "vitest";
import { gisSql } from "@/lib/gis/client";
import { buscarNaps, listarLocalidades, obtenerNapPorCodigo, pingGis } from "@/lib/gis/queries";

// Punto y NAP de referencia validados contra el PostGIS local (dump del 2026-09-09).
const PUNTO = { lat: -26.8419, lon: -65.1622 };
const NAP_PRUEBA = "303-01-08-N08-1-E";

describe("capa GIS (PostGIS local, solo lectura)", () => {
  afterAll(async () => {
    await gisSql.end({ timeout: 2 });
  });

  it("responde al ping", async () => {
    expect(await pingGis()).toBe(true);
  });

  it("devuelve 19 NAPs a 500 m del punto de prueba, ordenadas por distancia", async () => {
    const inicio = performance.now();
    const naps = await buscarNaps({ ...PUNTO, radio: 500, limite: 500 });
    const ms = performance.now() - inicio;

    expect(naps).toHaveLength(19);
    expect(naps[0]?.idNap).toBe(NAP_PRUEBA);
    expect(naps[0]?.metros).toBeLessThan(5);
    for (let i = 1; i < naps.length; i++) {
      expect(naps[i]!.metros).toBeGreaterThanOrEqual(naps[i - 1]!.metros);
      expect(naps[i]!.metros).toBeLessThanOrEqual(500);
    }
    expect(ms).toBeLessThan(300);
  });

  it("aplica filtros de disponibilidad, estado y localidad (sin tildes)", async () => {
    const todas = await buscarNaps({ ...PUNTO, radio: 500, limite: 500 });
    const conDisp = await buscarNaps({ ...PUNTO, radio: 500, limite: 500, soloDisponibles: true });
    expect(conDisp.length).toBeLessThanOrEqual(todas.length);
    expect(conDisp.every((n) => (n.disponibles ?? 0) > 0)).toBe(true);

    const instaladas = await buscarNaps({ ...PUNTO, radio: 500, limite: 500, estado: "I" });
    expect(instaladas.every((n) => n.estado === "I")).toBe(true);

    const conTilde = await buscarNaps({ ...PUNTO, radio: 500, limite: 500, localidad: "Banda del Río Salí" });
    const sinTilde = await buscarNaps({ ...PUNTO, radio: 500, limite: 500, localidad: "banda del rio sali" });
    expect(conTilde.length).toBe(sinTilde.length);
    expect(sinTilde.length).toBeGreaterThan(0);
  });

  it("respeta el límite", async () => {
    const naps = await buscarNaps({ ...PUNTO, radio: 5000, limite: 3 });
    expect(naps).toHaveLength(3);
  });

  it("encuentra una NAP por código, tolerando espacios y guiones bajos", async () => {
    const exacta = await obtenerNapPorCodigo(NAP_PRUEBA);
    expect(exacta?.idNap).toBe(NAP_PRUEBA);
    expect(exacta?.puertos).toBe(8);
    expect(exacta?.lat).toBeCloseTo(PUNTO.lat, 3);

    const sucia = await obtenerNapPorCodigo(" 303_01_08_n08_1_e ");
    expect(sucia?.idNap).toBe(NAP_PRUEBA);

    expect(await obtenerNapPorCodigo("NO-EXISTE-999")).toBeNull();
  });

  it("lista localidades sin duplicados por tildes", async () => {
    const localidades = await listarLocalidades();
    expect(localidades.length).toBeGreaterThan(3);
    const normalizadas = localidades.map((l) => l.toLowerCase().normalize("NFD").replace(/\p{M}/gu, ""));
    expect(new Set(normalizadas).size).toBe(normalizadas.length);
  });
});
