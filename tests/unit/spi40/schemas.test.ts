import { describe, expect, it } from "vitest";
import { envelopeSchema, macSchema, puertoNapSchema } from "@/lib/spi40/schemas";

describe("envelopeSchema", () => {
  it("acepta el sobre real de spi40 (errors como string vacío, records array)", () => {
    const r = envelopeSchema.parse([{ id_request: 1, id_transaction: 2, result_ok: true, errors: "", records: [] }]);
    expect(r[0]?.result_ok).toBe(true);
    expect(r[0]?.errors).toEqual([]);
    expect(r[0]?.records).toEqual([]);
  });

  it("acepta result_ok como string/número y errors como array", () => {
    const r = envelopeSchema.parse([{ result_ok: "1", errors: [{ property: "descripcion", message: "requerida" }], records: null }]);
    expect(r[0]?.result_ok).toBe(true);
    expect(r[0]?.errors[0]?.message).toBe("requerida");
    expect(r[0]?.records).toEqual([]);
  });

  it("rechaza un array vacío o un objeto suelto", () => {
    expect(envelopeSchema.safeParse([]).success).toBe(false);
    expect(envelopeSchema.safeParse({ result_ok: true }).success).toBe(false);
  });
});

describe("puertoNapSchema (22024)", () => {
  it("coerciona números en string y normaliza vacíos", () => {
    const p = puertoNapSchema.parse({
      id_nodo: "45638",
      id_padre: 45612,
      puerto: "1",
      estado: "2",
      tipo: 0,
      descripcion: "",
      id_cli: 0,
      denominacion_cli: "",
      mac_ont: "",
      serial_ont: "",
      modelo_ont: "",
    });
    expect(p.id_nodo).toBe(45638);
    expect(p.puerto).toBe(1);
    expect(p.mac_ont).toBeNull();
    expect(p.denominacion_cli).toBeNull();
    expect(p.serial_ont).toBeNull();
  });

  it("conserva datos de un puerto ocupado real", () => {
    const p = puertoNapSchema.parse({
      id_nodo: 45639,
      id_padre: 45612,
      puerto: 2,
      estado: 4,
      tipo: 22002,
      descripcion: "ONU DCN - DCEG164-VC1200",
      id_cli: 1008032,
      denominacion_cli: "Herrera, Luisa",
      mac_ont: "FC:C0:CC:22:C8:E7",
      serial_ont: "48575443cc22c8e7",
      modelo_ont: "DCN DCEG164-C-1200",
      campo_nuevo: "no rompe",
    });
    expect(p.mac_ont).toBe("fcc0cc22c8e7");
    expect(p.id_cli).toBe(1008032);
    expect(p.denominacion_cli).toBe("Herrera, Luisa");
  });
});

describe("macSchema", () => {
  it("trata 'N/A' y vacío como sin MAC", () => {
    expect(macSchema.parse("N/A")).toBeNull();
    expect(macSchema.parse("n/a")).toBeNull();
    expect(macSchema.parse("")).toBeNull();
    expect(macSchema.parse(null)).toBeNull();
  });
  it("normaliza separadores y mayúsculas", () => {
    expect(macSchema.parse("FC-C0-CC-22-C8-E7")).toBe("fcc0cc22c8e7");
  });
});
