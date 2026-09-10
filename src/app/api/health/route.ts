import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pingGis } from "@/lib/gis/queries";
import { getEstadoOnt } from "@/lib/olt/client";
import { getNapsDisponibles } from "@/lib/spi40/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inicio = Date.now();

/**
 * Salud del servicio. 200 si ambas bases responden, 503 si no.
 * ?deep=1 prueba además spi40 (acción 22015 con filtro) y la OLT (no afectan el código de estado).
 */
export async function GET(request: NextRequest) {
  const deep = request.nextUrl.searchParams.get("deep") === "1";
  const checks: Record<string, { ok: boolean; ms: number; detalle?: string }> = {};

  await Promise.all([
    medir("appDb", async () => {
      await db.execute(sql`SELECT 1`);
    }),
    medir("gisDb", async () => {
      if (!(await pingGis())) throw new Error("sin respuesta");
    }),
    ...(deep
      ? [
          medir("spi40", async () => {
            const r = await getNapsDisponibles("303-01-08", { usarCache: false, timeoutMs: 15000 });
            checks.spi40 = { ...(checks.spi40 ?? { ok: true, ms: 0 }), detalle: `${r.length} records` };
          }),
          medir("olt", async () => {
            const e = await getEstadoOnt("fcc0cc22c8e7", { usarCache: false, timeoutMs: 30000 });
            if (e.online === null) throw new Error("sin dato");
          }),
        ]
      : []),
  ]);

  const critico = checks.appDb?.ok && checks.gisDb?.ok;
  const status = critico ? (Object.values(checks).every((c) => c.ok) ? "ok" : "degraded") : "down";
  return NextResponse.json(
    { status, checks, uptimeS: Math.round((Date.now() - inicio) / 1000), version: process.env.npm_package_version ?? "dev" },
    { status: critico ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );

  async function medir(nombre: string, fn: () => Promise<void>) {
    const t = performance.now();
    try {
      await fn();
      checks[nombre] = { ...(checks[nombre] ?? {}), ok: true, ms: Math.round(performance.now() - t) };
    } catch (e) {
      checks[nombre] = { ok: false, ms: Math.round(performance.now() - t), detalle: e instanceof Error ? e.message : String(e) };
    }
  }
}
