/**
 * Caché en memoria con TTL y deduplicación de requests en vuelo.
 * Suficiente para una instancia; si se escala a varias réplicas, reemplazar por una caché compartida.
 */
interface Entrada<T> {
  valor: T;
  expira: number;
}

export class CacheTtl<T> {
  private readonly entradas = new Map<string, Entrada<T>>();
  private readonly enVuelo = new Map<string, Promise<T>>();

  constructor(private readonly ttlMs: number) {}

  get(clave: string): T | undefined {
    const e = this.entradas.get(clave);
    if (!e) return undefined;
    if (e.expira < Date.now()) {
      this.entradas.delete(clave);
      return undefined;
    }
    return e.valor;
  }

  set(clave: string, valor: T, ttlMs = this.ttlMs): void {
    this.entradas.set(clave, { valor, expira: Date.now() + ttlMs });
  }

  invalidar(clave: string): void {
    this.entradas.delete(clave);
  }

  limpiar(): void {
    this.entradas.clear();
    this.enVuelo.clear();
  }

  /** Devuelve el valor cacheado o ejecuta `productor` una sola vez aunque haya llamadas concurrentes. */
  async obtener(clave: string, productor: () => Promise<T>, opciones: { usarCache?: boolean; ttlMs?: number } = {}): Promise<T> {
    const usar = opciones.usarCache ?? true;
    if (usar) {
      const hit = this.get(clave);
      if (hit !== undefined) return hit;
      const pendiente = this.enVuelo.get(clave);
      if (pendiente) return pendiente;
    }
    const promesa = productor()
      .then((valor) => {
        if (usar) this.set(clave, valor, opciones.ttlMs);
        return valor;
      })
      .finally(() => {
        if (this.enVuelo.get(clave) === promesa) this.enVuelo.delete(clave);
      });
    if (usar) this.enVuelo.set(clave, promesa);
    return promesa;
  }
}
