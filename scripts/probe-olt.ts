/**
 * Prueba manual de las herramientas OLT.
 *   npm run probe:olt -- fcc0cc22c8e7 [otra-mac ...]
 *   npm run probe:olt -- --nap 303-01-08-N08-1-E     → consulta spi40 y luego el estado de todas las ONTs de la NAP en paralelo
 */
import "./_env";
import { getEstadosOnt, urlOnt } from "@/lib/olt/client";
import { getPuertosNap } from "@/lib/spi40/actions";

async function main() {
  const args = process.argv.slice(2);
  let macs: string[] = [];
  if (args[0] === "--nap" && args[1]) {
    const puertos = await getPuertosNap(args[1]);
    macs = puertos.map((p) => p.mac_ont).filter((m): m is string => Boolean(m));
    console.log(`NAP ${args[1]}: ${puertos.length} puertos, ${macs.length} con ONT`);
  } else {
    macs = args;
  }
  if (macs.length === 0) throw new Error("Uso: probe-olt <mac> [mac...] | --nap <codigo>");

  console.log("URL ejemplo:", urlOnt(macs[0]!));
  const inicio = performance.now();
  const estados = await getEstadosOnt(macs, { usarCache: false });
  const ms = Math.round(performance.now() - inicio);
  console.log(`\n${estados.size} ONTs consultadas en ${ms} ms\n`);
  console.table(
    [...estados.values()].map((e) => ({
      mac: e.mac,
      online: e.online,
      status: e.status,
      campos: Object.keys(e.detalle).length,
    })),
  );
  const primera = [...estados.values()][0];
  if (primera) console.log("Detalle de la primera:", primera.detalle);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
