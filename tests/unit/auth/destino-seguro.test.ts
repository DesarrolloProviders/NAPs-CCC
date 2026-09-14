import { describe, expect, it } from "vitest";
import { destinoSeguro } from "@/lib/auth/destino-seguro";

describe("destinoSeguro (post-login ?next=)", () => {
  it("acepta rutas internas con query", () => {
    expect(destinoSeguro("/buscar")).toBe("/buscar");
    expect(destinoSeguro("/buscar?lat=-26.8&lon=-65.1&radio=500")).toBe("/buscar?lat=-26.8&lon=-65.1&radio=500");
    expect(destinoSeguro("/naps/303-01-08-N08-1-E")).toBe("/naps/303-01-08-N08-1-E");
  });

  it.each([
    ["//evil.com", "protocol-relative"],
    ["//evil.com/buscar", "protocol-relative con path"],
    ["/\\evil.com", "barra invertida"],
    ["https://evil.com", "URL absoluta"],
    ["javascript:alert(1)", "esquema"],
    ["buscar", "relativa sin barra"],
    ["", "vacía"],
    ["/buscar\r\nSet-Cookie: x=1", "caracteres de control"],
    ["/bus car", "espacio"],
  ])("rechaza %s (%s) y vuelve al fallback", (entrada) => {
    expect(destinoSeguro(entrada)).toBe("/buscar");
  });

  it("rechaza valores que no son string y respeta el fallback dado", () => {
    expect(destinoSeguro(undefined)).toBe("/buscar");
    expect(destinoSeguro(["/a", "/b"])).toBe("/buscar");
    expect(destinoSeguro(42, "/otro")).toBe("/otro");
  });

  it("descarta rutas absurdamente largas", () => {
    expect(destinoSeguro("/" + "a".repeat(3000))).toBe("/buscar");
  });
});
