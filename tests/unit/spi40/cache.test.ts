import { describe, expect, it, vi } from "vitest";
import { CacheTtl } from "@/lib/spi40/cache";

describe("CacheTtl", () => {
  it("cachea dentro del TTL y expira después", () => {
    vi.useFakeTimers();
    const c = new CacheTtl<number>(1000);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    vi.advanceTimersByTime(1001);
    expect(c.get("a")).toBeUndefined();
    vi.useRealTimers();
  });

  it("deduplica llamadas concurrentes al mismo productor", async () => {
    const c = new CacheTtl<string>(1000);
    const productor = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return "valor";
    });
    const [a, b] = await Promise.all([c.obtener("k", productor), c.obtener("k", productor)]);
    expect(a).toBe("valor");
    expect(b).toBe("valor");
    expect(productor).toHaveBeenCalledTimes(1);
    expect(await c.obtener("k", productor)).toBe("valor");
    expect(productor).toHaveBeenCalledTimes(1);
  });

  it("con usarCache=false saltea la lectura pero guarda el valor fresco", async () => {
    const c = new CacheTtl<number>(1000);
    let n = 0;
    const productor = async () => ++n;
    expect(await c.obtener("k", productor)).toBe(1);
    expect(await c.obtener("k", productor, { usarCache: false })).toBe(2);
    // El siguiente pedido normal ve el valor fresco, no el viejo.
    expect(await c.obtener("k", productor)).toBe(2);
    expect(c.get("k")).toBe(2);
  });

  it("con usarCache=false sigue deduplicando las llamadas en vuelo", async () => {
    const c = new CacheTtl<number>(1000);
    const productor = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 7;
    });
    await Promise.all([
      c.obtener("k", productor, { usarCache: false }),
      c.obtener("k", productor, { usarCache: false }),
      c.obtener("k", productor),
    ]);
    expect(productor).toHaveBeenCalledTimes(1);
  });

  it("no cachea errores", async () => {
    const c = new CacheTtl<number>(1000);
    let n = 0;
    const productor = async () => {
      n++;
      if (n === 1) throw new Error("falla");
      return n;
    };
    await expect(c.obtener("k", productor)).rejects.toThrow("falla");
    expect(await c.obtener("k", productor)).toBe(2);
  });

  it("no crece más allá de maxEntradas (expulsa la más vieja)", () => {
    const c = new CacheTtl<number>(60_000, 3);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    c.set("d", 4);
    expect(c.size).toBe(3);
    expect(c.get("a")).toBeUndefined();
    expect(c.get("d")).toBe(4);
  });

  it("barre las entradas vencidas", () => {
    vi.useFakeTimers();
    const c = new CacheTtl<number>(100);
    c.set("a", 1);
    vi.advanceTimersByTime(101);
    c.set("b", 2, 10_000);
    c.barrer();
    expect(c.size).toBe(1);
    vi.useRealTimers();
  });
});
