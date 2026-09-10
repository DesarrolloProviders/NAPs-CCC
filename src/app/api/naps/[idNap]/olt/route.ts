import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { esIdNapValido } from "@/lib/nap/normalizar-id-nap";
import { getEstadosOnt } from "@/lib/olt/client";
import { getPuertosNap } from "@/lib/spi40/actions";
import { esSpi40Error } from "@/lib/spi40/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface EstadoOltRespuesta {
  estados: Record<string, { online: boolean | null; status: number | null; consultadoEn: string; detalle: Record<string, string | number | boolean | null> }>;
  consultadas: number;
}

/**
 * Estado online de las ONTs de una NAP (carga diferida: la OLT tarda entre 7 y 25 s por ONT).
 * GET /api/naps/[idNap]/olt?refresh=1  → ignora la caché
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/naps/[idNap]/olt">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { idNap } = await ctx.params;
  const codigo = decodeURIComponent(idNap);
  if (!esIdNapValido(codigo)) return NextResponse.json({ error: "Código de NAP inválido" }, { status: 400 });
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  let macs: string[];
  try {
    const puertos = await getPuertosNap(codigo);
    macs = puertos.map((p) => p.mac_ont).filter((m): m is string => Boolean(m));
  } catch (e) {
    const mensaje = esSpi40Error(e) ? e.toUserMessage() : "No se pudo consultar el sistema de abonados";
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }

  const estados = await getEstadosOnt(macs, { usarCache: !refresh });
  const cuerpo: EstadoOltRespuesta = {
    estados: Object.fromEntries(
      [...estados.entries()].map(([mac, e]) => [mac, { online: e.online, status: e.status, consultadoEn: e.consultadoEn, detalle: e.detalle }]),
    ),
    consultadas: estados.size,
  };
  return NextResponse.json(cuerpo, { headers: { "Cache-Control": "private, max-age=20" } });
}
