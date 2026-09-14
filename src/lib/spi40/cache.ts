/**
 * Caché en memoria con TTL, cota de tamaño y deduplicación de requests en vuelo.
 * Suficiente para una instancia; si se escala a varias réplicas, reemplazar por una caché compartida.
 */
interface Entrada<T> {
  valor: T;
  expira: number;
}

const MAX_ENTRADAS_DEFAULT = 2000;
/** Cada tantos `set` se barren las entradas vencidas (evita crecer con claves que nunca se vuelven a pedir). */
const SETS_ENTRE_BARRIDOS = 100;

export class CacheTtl<T> {
  private readonly entradas = new Map<string, Entrada<T>>();
  private readonly enVuelo = new Map<string, Promise<T>>();
  private setsDesdeBarrido = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntradas = MAX_ENTRADAS_DEFAULT,
  ) {}

  get size(): number {
    return this.entradas.size;
  }

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
    // Reinsertar al final para que el orden del Map sea "más viejo primero".
    this.entradas.delete(clave);
    this.entradas.set(clave, { valor, expira: Date.now() + ttlMs });
    if (++this.setsDesdeBarrido >= SETS_ENTRE_BARRIDOS) this.barrer();
    while (this.entradas.size > this.maxEntradas) {
      const masVieja = this.entradas.keys().next().value;
      if (masVieja === undefined) break;
      this.entradas.delete(masVieja);
    }
  }

  invalidar(clave: string): void {
    this.entradas.delete(clave);
  }

  limpiar(): void {
    this.entradas.clear();
    this.enVuelo.clear();
  }

  /** Borra las entradas vencidas. */
  barrer(): void {
    this.setsDesdeBarrido = 0;
    const ahora = Date.now();
    for (const [clave, e] of this.entradas) if (e.expira < ahora) this.entradas.delete(clave);
  }

  /**
   * Devuelve el valor cacheado o ejecuta `productor` una sola vez aunque haya llamadas concurrentes.
   * `usarCache: false` saltea la LECTURA (fuerza un valor fresco) pero el resultado se guarda igual y
   * las llamadas concurrentes a la misma clave siguen compartiendo una única ejecución.
   */
  async obtener(clave: string, productor: () => Promise<T>, opciones: { usarCache?: boolean; ttlMs?: number } = {}): Promise<T> {
    const leer = opciones.usarCache ?? true;
    if (leer) {
      const hit = this.get(clave);
      if (hit !== undefined) return hit;
    }
    const pendiente = this.enVuelo.get(clave);
    if (pendiente) return pendiente;
    const promesa = productor()
      .then((valor) => {
        this.set(clave, valor, opciones.ttlMs);
        return valor;
      })
      .finally(() => {
        if (this.enVuelo.get(clave) === promesa) this.enVuelo.delete(clave);
      });
    this.enVuelo.set(clave, promesa);
    return promesa;
  }
}
