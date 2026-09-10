/**
 * Marca como vencidas las reservas activas cuya fecha ya pasó (equivalente CLI del endpoint /api/cron/vencer-reservas).
 *   npm run vencer:reservas
 */
import "./_env";
import { appSql } from "@/db/client";
import { vencerReservas } from "@/features/reservas/repo";

async function main() {
  const n = await vencerReservas(null);
  console.log(`Reservas vencidas: ${n}`);
  await appSql.end({ timeout: 2 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
