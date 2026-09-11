import { describe, expect, it } from "vitest";
import { estadoPuerto, type EntradaEstado } from "@/features/puertos/estado-puerto";

const base: EntradaEstado = { macOnt: null, idCliente: null, online: null };

describe("estadoPuerto (regla del legacy: online > ocupado > libre)", () => {
  it("sin MAC ni cliente → libre", () => {
    expect(estadoPuerto(base)).toBe("libre");
  });
  it("con MAC y OLT sin dato → ocupado", () => {
    expect(estadoPuerto({ ...base, macOnt: "fcc0cc22c8e7" })).toBe("ocupado");
  });
  it("con MAC y OLT offline → ocupado", () => {
    expect(estadoPuerto({ ...base, macOnt: "fcc0cc22c8e7", online: false })).toBe("ocupado");
  });
  it("con MAC y OLT online → online", () => {
    expect(estadoPuerto({ ...base, macOnt: "fcc0cc22c8e7", online: true })).toBe("online");
  });
  it("con cliente pero sin MAC → ocupado", () => {
    expect(estadoPuerto({ ...base, idCliente: 1008032 })).toBe("ocupado");
  });
  it("id_cli 0 no cuenta como cliente", () => {
    expect(estadoPuerto({ ...base, idCliente: 0 })).toBe("libre");
  });
  it("sin ONT, el dato de la OLT no cambia el estado", () => {
    expect(estadoPuerto({ ...base, online: true })).toBe("libre");
  });
});
