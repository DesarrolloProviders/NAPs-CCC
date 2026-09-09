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

  it("con usarCache=false siempre ejecuta y no guarda", async () => {
    const c = new CacheTtl<number>(1000);
    let n = 0;
    const productor = async () => ++n;
    expect(await c.obtener("k", productor, { usarCache: false })).toBe(1);
    expect(await c.obtener("k", productor, { usarCache: false })).toBe(2);
    expect(c.get("k")).toBeUndefined();
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
});
