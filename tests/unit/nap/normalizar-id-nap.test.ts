import { describe, expect, it } from "vitest";
import { esIdNapValido, normalizarIdNap } from "@/lib/nap/normalizar-id-nap";

describe("normalizarIdNap", () => {
  it("deja igual un código ya limpio", () => {
    expect(normalizarIdNap("303-01-08-N08-1-E")).toBe("303-01-08-N08-1-E");
  });

  it("recorta espacios externos e internos", () => {
    expect(normalizarIdNap("  303-01-08-N08-1-E ")).toBe("303-01-08-N08-1-E");
    expect(normalizarIdNap("303 -01- 08")).toBe("303-01-08");
  });

  it("convierte guion bajo a guion y mayúsculas", () => {
    expect(normalizarIdNap("047_02_33")).toBe("047-02-33");
    expect(normalizarIdNap("tu-br-a069")).toBe("TU-BR-A069");
  });

  it("colapsa guiones repetidos", () => {
    expect(normalizarIdNap("411--10-24")).toBe("411-10-24");
  });

  it("devuelve vacío para null/undefined/vacío", () => {
    expect(normalizarIdNap(null)).toBe("");
    expect(normalizarIdNap(undefined)).toBe("");
    expect(normalizarIdNap("   ")).toBe("");
  });
});

describe("esIdNapValido", () => {
  it("acepta códigos alfanuméricos con guiones", () => {
    expect(esIdNapValido("303-01-08-N08-1-E")).toBe(true);
    expect(esIdNapValido("047_02_33")).toBe(true);
  });
  it("rechaza inyecciones y basura", () => {
    expect(esIdNapValido("'; DROP TABLE naps; --")).toBe(false);
    expect(esIdNapValido("ab")).toBe(false);
    expect(esIdNapValido("")).toBe(false);
  });
});
