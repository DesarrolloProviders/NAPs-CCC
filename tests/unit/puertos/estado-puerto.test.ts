import { describe, expect, it } from "vitest";
import { estadoPuerto, sePuedeInstalar, sePuedeReservar, type EntradaEstado } from "@/features/puertos/estado-puerto";

const base: EntradaEstado = { macOnt: null, idCliente: null, online: null, reservaVigente: false, instaladoReciente: false };

describe("estadoPuerto (regla del legacy: reservado > online > ocupado > libre)", () => {
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
  it("reserva vigente gana a todo, incluso online", () => {
    expect(estadoPuerto({ ...base, macOnt: "fcc0cc22c8e7", online: true, reservaVigente: true })).toBe("reservado");
    expect(estadoPuerto({ ...base, reservaVigente: true })).toBe("reservado");
  });
  it("instalado reciente sin MAC todavía → instalado; con MAC ya → ocupado/online", () => {
    expect(estadoPuerto({ ...base, instaladoReciente: true })).toBe("instalado");
    expect(estadoPuerto({ ...base, instaladoReciente: true, macOnt: "aa" })).toBe("ocupado");
  });
});

describe("permisos derivados del estado", () => {
  it("solo se reserva un puerto libre", () => {
    expect(sePuedeReservar("libre")).toBe(true);
    expect(sePuedeReservar("reservado")).toBe(false);
    expect(sePuedeReservar("ocupado")).toBe(false);
  });
  it("se instala un puerto reservado o libre", () => {
    expect(sePuedeInstalar("reservado")).toBe(true);
    expect(sePuedeInstalar("libre")).toBe(true);
    expect(sePuedeInstalar("online")).toBe(false);
  });
});
