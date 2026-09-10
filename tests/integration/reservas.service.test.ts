import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reglas de negocio de reservas contra la base de test (APP_DATABASE_URL_TEST) con spi40 simulado.
 * Requiere `npm run db:migrate` sobre la base de test (lo hace el beforeAll) y `docker compose up -d app-db`.
 */
const puertosMock = vi.fn();
vi.mock("@/lib/spi40/actions", () => ({ getPuertosNap: (...args: unknown[]) => puertosMock(...args) }));

const ID_NAP = "TEST-01-01-N08-1-E";
const PUERTO_LIBRE = { id_nodo: 900001, id_padre: 1, puerto: 1, estado: 2, tipo: 0, descripcion: "", id_cli: 0, denominacion_cli: null, mac_ont: null, serial_ont: null, modelo_ont: null };
const PUERTO_OCUPADO = { ...PUERTO_LIBRE, id_nodo: 900002, puerto: 2, estado: 4, id_cli: 123, denominacion_cli: "Cliente", mac_ont: "aabbccddeeff" };

let actorVentas: { id: string; nombre: string; email: string; rol: "ventas" };
let actorTecnico: { id: string; nombre: string; email: string; rol: "tecnico" };

describe("servicio de reservas", () => {
  beforeAll(async () => {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const { db } = await import("@/db/client");
    await migrate(db, { migrationsFolder: "drizzle" });
    const { user } = await import("@/db/schema");
    const ahora = new Date();
    const crear = async (rol: "ventas" | "tecnico") => {
      const id = randomUUID();
      await db.insert(user).values({ id, email: `${rol}-${id}@test.local`, name: `Test ${rol}`, role: rol, createdAt: ahora, updatedAt: ahora });
      return { id, nombre: `Test ${rol}`, email: `${rol}-${id}@test.local`, rol };
    };
    actorVentas = (await crear("ventas")) as typeof actorVentas;
    actorTecnico = (await crear("tecnico")) as typeof actorTecnico;
  });

  beforeEach(async () => {
    const { appSql } = await import("@/db/client");
    await appSql`DELETE FROM reserva_eventos`;
    await appSql`DELETE FROM reservas`;
    puertosMock.mockReset();
    puertosMock.mockResolvedValue([PUERTO_LIBRE, PUERTO_OCUPADO]);
  });

  afterAll(async () => {
    const { appSql } = await import("@/db/client");
    await appSql`DELETE FROM reserva_eventos`;
    await appSql`DELETE FROM reservas`;
    await appSql`DELETE FROM "user" WHERE email LIKE '%@test.local'`;
    await appSql.end({ timeout: 2 });
  });

  it("reserva un puerto libre, registra evento y calcula el vencimiento", async () => {
    const { reservarPuerto } = await import("@/features/reservas/service");
    const { historialPorIdNodo } = await import("@/features/reservas/repo");
    const r = await reservarPuerto({ idNap: ID_NAP, idNodo: 900001, puerto: 1, observacion: "1004999 test", diasVigencia: 5 }, actorVentas);
    expect(r.estado).toBe("activa");
    expect(r.idNapNorm).toBe(ID_NAP);
    expect(puertosMock).toHaveBeenCalledWith(ID_NAP, { usarCache: false });
    const hist = await historialPorIdNodo(900001);
    expect(hist[0]?.eventos.map((e) => e.tipo)).toEqual(["creada"]);
    const dias = Math.round((new Date(r.venceEn).getTime() - Date.now()) / 86_400_000);
    expect(dias).toBeGreaterThanOrEqual(4);
    expect(dias).toBeLessThanOrEqual(5);
  });

  it("rechaza reservar un puerto ocupado en spi40", async () => {
    const { reservarPuerto } = await import("@/features/reservas/service");
    await expect(reservarPuerto({ idNap: ID_NAP, idNodo: 900002, puerto: 2, observacion: "x test" }, actorVentas)).rejects.toMatchObject({ codigo: "PUERTO_OCUPADO" });
  });

  it("rechaza un puerto que no pertenece a la NAP y si spi40 no responde", async () => {
    const { reservarPuerto } = await import("@/features/reservas/service");
    await expect(reservarPuerto({ idNap: ID_NAP, idNodo: 999999, puerto: 9, observacion: "x test" }, actorVentas)).rejects.toMatchObject({ codigo: "PUERTO_NO_PERTENECE" });
    puertosMock.mockRejectedValue(new Error("timeout"));
    await expect(reservarPuerto({ idNap: ID_NAP, idNodo: 900001, puerto: 1, observacion: "x test" }, actorVentas)).rejects.toMatchObject({ codigo: "SPI40_NO_DISPONIBLE" });
  });

  it("no permite dos reservas activas del mismo puerto (también en carrera)", async () => {
    const { reservarPuerto } = await import("@/features/reservas/service");
    await reservarPuerto({ idNap: ID_NAP, idNodo: 900001, puerto: 1, observacion: "primera" }, actorVentas);
    await expect(reservarPuerto({ idNap: ID_NAP, idNodo: 900001, puerto: 1, observacion: "segunda" }, actorVentas)).rejects.toMatchObject({ codigo: "PUERTO_YA_RESERVADO" });

    const { appSql } = await import("@/db/client");
    await appSql`DELETE FROM reserva_eventos`;
    await appSql`DELETE FROM reservas`;
    const resultados = await Promise.allSettled([
      reservarPuerto({ idNap: ID_NAP, idNodo: 900001, puerto: 1, observacion: "carrera A" }, actorVentas),
      reservarPuerto({ idNap: ID_NAP, idNodo: 900001, puerto: 1, observacion: "carrera B" }, actorVentas),
    ]);
    const ok = resultados.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(1);
  });

  it("liberar e instalar cierran la reserva con auditoría", async () => {
    const { reservarPuerto, liberarReserva, instalarPuerto } = await import("@/features/reservas/service");
    const { historialPorIdNodo } = await import("@/features/reservas/repo");
    const r = await reservarPuerto({ idNap: ID_NAP, idNodo: 900001, puerto: 1, observacion: "para liberar" }, actorVentas);
    const lib = await liberarReserva({ reservaId: r.id, motivo: "desistió" }, actorTecnico);
    expect(lib.estado).toBe("liberada");
    await expect(liberarReserva({ reservaId: r.id, motivo: undefined }, actorTecnico)).rejects.toMatchObject({ codigo: "RESERVA_NO_ACTIVA" });

    const r2 = await reservarPuerto({ idNap: ID_NAP, idNodo: 900001, puerto: 1, observacion: "para instalar" }, actorVentas);
    const inst = await instalarPuerto({ idNap: ID_NAP, idNodo: 900001, puerto: 1, nroAbonado: "1004999", observacion: undefined }, actorTecnico);
    expect(inst.id).toBe(r2.id);
    expect(inst.estado).toBe("instalada");
    expect(inst.nroAbonado).toBe("1004999");

    const hist = await historialPorIdNodo(900001);
    expect(hist).toHaveLength(2);
    expect(hist.flatMap((h) => h.eventos.map((e) => e.tipo)).sort()).toEqual(["creada", "creada", "instalada", "liberada"]);
  });

  it("una activa vencida no bloquea una nueva reserva", async () => {
    const { reservarPuerto } = await import("@/features/reservas/service");
    const { appSql } = await import("@/db/client");
    const r = await reservarPuerto({ idNap: ID_NAP, idNodo: 900001, puerto: 1, observacion: "vieja" }, actorVentas);
    await appSql`UPDATE reservas SET vence_en = '2020-01-01' WHERE id = ${r.id}`;
    const nueva = await reservarPuerto({ idNap: ID_NAP, idNodo: 900001, puerto: 1, observacion: "nueva" }, actorVentas);
    expect(nueva.id).not.toBe(r.id);
    const [vieja] = await appSql`SELECT estado FROM reservas WHERE id = ${r.id}`;
    expect(vieja?.estado).toBe("vencida");
  });
});
