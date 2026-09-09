/**
 * Prueba manual del webservice spi40.
 *   npm run probe:spi40 -- 22024 303-01-08-N08-1-E            → puertos de la NAP
 *   npm run probe:spi40 -- 22024 303-01-08-N08-1-E --save-fixture   → además guarda tests/fixtures/spi40/22024_<codigo>.json
 *   npm run probe:spi40 -- 22002 --mac fcc0cc22c8e7           → ONT/cliente por MAC
 *   npm run probe:spi40 -- 22015 303-01                       → NAPs con disponibles (descripcion como filtro)
 *   npm run probe:spi40 -- --muestra 20                       → toma 20 id_nap al azar de PostGIS y verifica que spi40 los resuelva
 */
import "./_env";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { llamarSpi40 } from "@/lib/spi40/client";
import { getPuertosNap } from "@/lib/spi40/actions";
import { ID_ACTION } from "@/lib/spi40/schemas";
import { esSpi40Error } from "@/lib/spi40/errors";

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const pos = args.filter((a) => !a.startsWith("--"));

  if (flags.has("--muestra")) {
    await verificarMuestra(Number(pos[0] ?? 20));
    return;
  }

  const idAction = Number(pos[0]);
  if (!Number.isFinite(idAction)) throw new Error("Uso: probe-spi40 <id_action> [descripcion] [--mac X] [--save-fixture]");

  const params: Record<string, unknown> = {};
  const iMac = args.indexOf("--mac");
  if (iMac >= 0 && args[iMac + 1]) params.mac = args[iMac + 1];
  else if (pos[1] !== undefined) params.descripcion = pos[1];
  else if (idAction === ID_ACTION.NAPS_DISPONIBLES) params.descripcion = "";

  const inicio = performance.now();
  const envelope = await llamarSpi40(idAction, params, { usarCache: false });
  const ms = Math.round(performance.now() - inicio);
  console.log(`\nid_action ${idAction} ${JSON.stringify(params)} → result_ok=${envelope.result_ok}, ${envelope.records.length} records, ${ms} ms`);
  console.log(JSON.stringify(envelope.records.slice(0, 20), null, 2));

  if (flags.has("--save-fixture")) {
    const dir = path.join("tests", "fixtures", "spi40");
    mkdirSync(dir, { recursive: true });
    const nombre = `${idAction}_${String(params.descripcion ?? params.mac ?? "todos").replace(/[^A-Za-z0-9-]/g, "_")}.json`;
    writeFileSync(path.join(dir, nombre), JSON.stringify([envelope], null, 2) + "\n", "utf8");
    console.log(`Fixture guardada en ${path.join(dir, nombre)}`);
  }
}

/** Verifica que los códigos de PostGIS resuelvan en spi40 (records > 0). */
async function verificarMuestra(n: number) {
  const { gisSql } = await import("@/lib/gis/client");
  const filas = await gisSql<{ id_nap: string }[]>`
    SELECT trim(id_nap) AS id_nap FROM nap_con_disponibilidad WHERE id_nap IS NOT NULL AND estado = 'I' ORDER BY random() LIMIT ${n}`;
  let ok = 0;
  const sinRecords: string[] = [];
  const errores: string[] = [];
  for (const f of filas) {
    try {
      const puertos = await getPuertosNap(f.id_nap, { usarCache: false });
      if (puertos.length > 0) ok++;
      else sinRecords.push(f.id_nap);
    } catch (e) {
      errores.push(`${f.id_nap}: ${esSpi40Error(e) ? e.kind : String(e)}`);
    }
  }
  console.log(`\nMuestra de ${filas.length} NAPs instaladas: ${ok} con puertos en spi40, ${sinRecords.length} sin records, ${errores.length} errores`);
  if (sinRecords.length) console.log("Sin records:", sinRecords.join(", "));
  if (errores.length) console.log("Errores:", errores.join("\n"));
  await gisSql.end({ timeout: 2 });
}

main().catch((e) => {
  console.error(esSpi40Error(e) ? e.toJSON() : e);
  process.exitCode = 1;
});
