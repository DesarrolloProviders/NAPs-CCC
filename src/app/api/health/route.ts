import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { actorDe, getSession } from "@/lib/auth/session";
import { puede } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { pingGis } from "@/lib/gis/queries";
import { loggerDe } from "@/lib/logger";
import { getEstadoOnt } from "@/lib/olt/client";
import { getNapsDisponibles } from "@/lib/spi40/actions";
import { CacheTtl } from "@/lib/spi40/cache";
import { esSpi40Error } from "@/lib/spi40/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = loggerDe("http");
const inicio = Date.now();
const NO_STORE = { "Cache-Control": "no-store" } as const;

type Check = { ok: boolean; ms: number; detalle?: string };
type Checks = Record<string, Check>;

/** El chequeo profundo golpea spi40 y la OLT: como máximo una ejecución por minuto, aunque lleguen N pedidos. */
const deepCache = new CacheTtl<Checks>(60_000);

/**
 * Salud del servicio.
 *   GET /api/health          → 200/503 según la base propia. Sin detalles (es alcanzable sin sesión).
 *   GET /api/health?deep=1   → además PostGIS, spi40 y OLT. Requiere `Authorization: Bearer HEALTH_TOKEN`
 *                              o sesión de administrador. Nunca devuelve mensajes de error crudos.
 */
export async function GET(request: NextRequest) {
  const deep = request.nextUrl.searchParams.get("deep") === "1";
  const base = { uptimeS: Math.round((Date.now() - inicio) / 1000), version: process.env.APP_VERSION ?? "dev" };

  if (!deep) {
    const appDb = await medir(() => db.execute(sql`SELECT 1`));
    return NextResponse.json({ status: appDb.ok ? "ok" : "down", ...base }, { status: appDb.ok ? 200 : 503, headers: NO_STORE });
  }

  if (!(await autorizadoDeep(request))) return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: NO_STORE });

  const checks = await deepCache.obtener("deep", ejecutarDeep);
  const critico = Boolean(checks.appDb?.ok && checks.gisDb?.ok);
  const status = critico ? (Object.values(checks).every((c) => c.ok) ? "ok" : "degraded") : "down";
  return NextResponse.json({ status, checks, ...base }, { status: critico ? 200 : 503, headers: NO_STORE });
}

async function ejecutarDeep(): Promise<Checks> {
  const checks: Checks = {};
  const tareas: Array<Promise<void>> = [
    medir(() => db.execute(sql`SELECT 1`)).then((c) => void (checks.appDb = c)),
    medir(async () => {
      if (!(await pingGis())) throw new Error("sin respuesta");
    }).then((c) => void (checks.gisDb = c)),
    medir(async () => {
      const r = await getNapsDisponibles("303-01-08", { timeoutMs: 15000 });
      return `${r.length} records`;
    }).then((c) => void (checks.spi40 = c)),
  ];
  if (env.HEALTH_OLT_MAC) {
    tareas.push(
      medir(async () => {
        const e = await getEstadoOnt(env.HEALTH_OLT_MAC!, { timeoutMs: 15000 });
        if (e.online === null) throw new Error("sin dato");
      }).then((c) => void (checks.olt = c)),
    );
  }
  await Promise.all(tareas);
  return checks;
}

/** Ejecuta un chequeo midiendo el tiempo. El detalle del error va al log, nunca a la respuesta. */
async function medir(fn: () => Promise<unknown>): Promise<Check> {
  const t = performance.now();
  try {
    const resultado = await fn();
    return { ok: true, ms: Math.round(performance.now() - t), ...(typeof resultado === "string" ? { detalle: resultado } : {}) };
  } catch (e) {
    log.warn({ err: e }, "health check falló");
    const tipo = esSpi40Error(e) ? e.kind : e instanceof Error ? e.name : "error";
    return { ok: false, ms: Math.round(performance.now() - t), detalle: tipo };
  }
}

async function autorizadoDeep(request: NextRequest): Promise<boolean> {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (env.HEALTH_TOKEN && bearer && igualConstante(bearer, env.HEALTH_TOKEN)) return true;
  const s = await getSession();
  return s !== null && puede(actorDe(s).rol, "usuarios");
}

/** Comparación en tiempo constante (se comparan los hashes para que la longitud no filtre nada). */
function igualConstante(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
