import { NextResponse, type NextRequest } from "next/server";
import { vencerReservas } from "@/features/reservas/repo";
import { env } from "@/lib/env";
import { loggerDe } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pasa a 'vencida' las reservas activas cuya fecha ya pasó (histórico; la lectura ya filtra por fecha).
 *   POST /api/cron/vencer-reservas  con  Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.CRON_SECRET}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const cantidad = await vencerReservas(null);
  loggerDe("reservas").info({ cantidad }, "cron vencer-reservas");
  return NextResponse.json({ ok: true, vencidas: cantidad });
}
