/**
 * Prueba manual de la capa GIS contra el PostGIS configurado en GIS_DATABASE_URL.
 *   npx tsx scripts/probe-gis.ts -26.8419 -65.1622 500
 *   npx tsx scripts/probe-gis.ts --codigo 303-01-08-N08-1-E
 */
import "./_env";
import { buscarNaps, listarLocalidades, obtenerNapPorCodigo } from "@/lib/gis/queries";
import { gisSql } from "@/lib/gis/client";
import { formatoMetros } from "@/lib/geo/formato";

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--codigo" && args[1]) {
    const nap = await obtenerNapPorCodigo(args[1]);
    console.log(nap ?? `No existe la NAP ${args[1]}`);
    return;
  }
  const lat = Number(args[0] ?? -26.8419);
  const lon = Number(args[1] ?? -65.1622);
  const radio = Number(args[2] ?? 500);

  const inicio = performance.now();
  const naps = await buscarNaps({ lat, lon, radio, limite: 500 });
  const ms = Math.round(performance.now() - inicio);

  console.log(`\n${naps.length} NAPs a ${radio} m de (${lat}, ${lon}) en ${ms} ms\n`);
  console.table(
    naps.map((n) => ({
      id_nap: n.idNap,
      localidad: n.localidad,
      puertos: n.puertos,
      disponibles: n.disponibles,
      estado: n.estado,
      distancia: formatoMetros(n.metros),
    })),
  );
  console.log("Localidades:", (await listarLocalidades()).join(" | "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => gisSql.end({ timeout: 2 }));
