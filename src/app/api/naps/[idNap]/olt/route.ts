import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { obtenerNapPorCodigo } from "@/lib/gis/queries";
import { esIdNapValido, normalizarIdNap } from "@/lib/nap/normalizar-id-nap";
import { getEstadosOnt } from "@/lib/olt/client";
import { getPuertosNap } from "@/lib/spi40/actions";
import { CacheTtl } from "@/lib/spi40/cache";
import { esSpi40Error } from "@/lib/spi40/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface EstadoOltRespuesta {
  estados: Record<string, { online: boolean | null; status: number | null; consultadoEn: string; detalle: Record<string, string | number | boolean | null> }>;
  consultadas: number;
  /** true si se pidió `refresh=1` pero el mismo usuario ya refrescó esta NAP hace menos de OLT_REFRESH_MIN_MS. */
  throttled: boolean;
}

/** Último refresh forzado por usuario+NAP: un refresh en bucle no debe multiplicar consultas a la OLT. */
const refreshReciente = new CacheTtl<number>(env.OLT_REFRESH_MIN_MS);

/**
 * Estado online de las ONTs de una NAP (carga diferida: la OLT tarda entre 7 y 25 s por ONT).
 * GET /api/naps/[idNap]/olt?refresh=1  → fuerza la consulta (como máximo una vez cada OLT_REFRESH_MIN_MS por usuario y NAP)
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/naps/[idNap]/olt">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { idNap } = await ctx.params;
  const codigo = decodeURIComponent(idNap);
  if (!esIdNapValido(codigo)) return NextResponse.json({ error: "Código de NAP inválido" }, { status: 400 });

  // A spi40 se le manda el código exacto de PostGIS, no lo que vino en la URL.
  const nap = await obtenerNapPorCodigo(codigo).catch(() => null);
  if (!nap) return NextResponse.json({ error: "NAP inexistente" }, { status: 404 });

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const claveThrottle = `${session.user.id}:${normalizarIdNap(nap.idNap)}`;
  const forzar = refresh && refreshReciente.get(claveThrottle) === undefined;
  if (forzar) refreshReciente.set(claveThrottle, Date.now());

  let macs: string[];
  try {
    const puertos = await getPuertosNap(nap.idNap);
    macs = puertos.map((p) => p.mac_ont).filter((m): m is string => Boolean(m));
  } catch (e) {
    const mensaje = esSpi40Error(e) ? e.toUserMessage() : "No se pudo consultar el sistema de abonados";
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }

  const estados = await getEstadosOnt(macs, { usarCache: !forzar });
  const cuerpo: EstadoOltRespuesta = {
    estados: Object.fromEntries(
      [...estados.entries()].map(([mac, e]) => [mac, { online: e.online, status: e.status, consultadoEn: e.consultadoEn, detalle: e.detalle }]),
    ),
    consultadas: estados.size,
    throttled: refresh && !forzar,
  };
  return NextResponse.json(cuerpo, { headers: { "Cache-Control": "private, max-age=20" } });
}
