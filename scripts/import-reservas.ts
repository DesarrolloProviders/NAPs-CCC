/**
 * Importa las reservas del legacy (MySQL cccgo.reservas) a la base propia a partir del dump SQL.
 *   npm run import:reservas -- ../legacy-php/db/mysql/cccgo.sql [--desde=YYYY-MM-DD] [--dry-run]
 *
 * - Filas con fecha >= --desde (default: hoy) → 'activa'; el resto → 'vencida' (histórico).
 * - origen='legacy_import', legacy_snapshot con la fila original, evento 'importada' del usuario sistema importacion@legacy.
 * - Idempotente: el índice único (origen, id_nodo, vence_en) evita duplicados; una activa existente no se pisa.
 */
import "./_env";
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db, appSql } from "@/db/client";
import { reservaEventos, reservas, user } from "@/db/schema";
import { aFechaIso, hoy } from "@/lib/fechas";
import { normalizarIdNap } from "@/lib/nap/normalizar-id-nap";

interface FilaLegacy {
  id_nodo: number;
  nap: string | null;
  fecha: string;
  observacion: string;
}

/** Tokeniza `INSERT INTO \`reservas\` VALUES (...),(...);` respetando comillas, escapes y NULL. */
export function parsearInsertReservas(sql: string): FilaLegacy[] {
  const filas: FilaLegacy[] = [];
  const re = /INSERT INTO `reservas` VALUES\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    let i = m.index + m[0].length;
    // Recorre tuplas hasta el ';' final
    while (i < sql.length) {
      while (i < sql.length && /[\s,]/.test(sql[i]!)) i++;
      if (sql[i] === ";") break;
      if (sql[i] !== "(") break;
      i++;
      const valores: (string | null)[] = [];
      let actual = "";
      let enCadena = false;
      let terminado = false;
      while (i < sql.length && !terminado) {
        const c = sql[i]!;
        if (enCadena) {
          if (c === "\\") {
            const s = sql[i + 1]!;
            actual += s === "n" ? "\n" : s === "r" ? "\r" : s === "t" ? "\t" : s === "0" ? "\0" : s;
            i += 2;
            continue;
          }
          if (c === "'") {
            if (sql[i + 1] === "'") {
              actual += "'";
              i += 2;
              continue;
            }
            enCadena = false;
            i++;
            continue;
          }
          actual += c;
          i++;
          continue;
        }
        if (c === "'") {
          enCadena = true;
          i++;
          continue;
        }
        if (c === "," || c === ")") {
          const t = actual.trim();
          valores.push(t === "NULL" ? null : t);
          actual = "";
          if (c === ")") terminado = true;
          i++;
          continue;
        }
        actual += c;
        i++;
      }
      const [idNodo, nap, fecha, observacion] = valores;
      if (idNodo !== null && idNodo !== undefined && fecha) {
        filas.push({ id_nodo: Number(idNodo), nap: nap ?? null, fecha, observacion: observacion ?? "" });
      }
    }
  }
  return filas;
}

async function main() {
  const args = process.argv.slice(2);
  const ruta = args.find((a) => !a.startsWith("--"));
  if (!ruta) throw new Error("Uso: import-reservas <ruta cccgo.sql> [--desde=YYYY-MM-DD] [--dry-run]");
  const dryRun = args.includes("--dry-run");
  const desde = args.find((a) => a.startsWith("--desde="))?.slice("--desde=".length) ?? aFechaIso(hoy());

  const sql = readFileSync(ruta, "utf8");
  const filas = parsearInsertReservas(sql);
  const actor = await db.query.user.findFirst({ where: eq(user.email, "importacion@legacy") });
  if (!actor && !dryRun) throw new Error("Falta el usuario de sistema importacion@legacy: corré `npm run seed:admin` primero.");

  const resumen = { leidas: filas.length, activas: 0, vencidas: 0, duplicadas: 0, napNull: 0, activaExistente: 0 };
  for (const f of filas) {
    const esActiva = f.fecha >= desde;
    if (f.nap === null) resumen.napNull++;
    if (dryRun) {
      if (esActiva) resumen.activas++;
      else resumen.vencidas++;
      continue;
    }
    await db.transaction(async (tx) => {
      const existente = await tx.query.reservas.findFirst({
        where: and(eq(reservas.origen, "legacy_import"), eq(reservas.idNodo, f.id_nodo), eq(reservas.venceEn, f.fecha)),
      });
      if (existente) {
        resumen.duplicadas++;
        return;
      }
      if (esActiva) {
        const activa = await tx.query.reservas.findFirst({ where: and(eq(reservas.idNodo, f.id_nodo), eq(reservas.estado, "activa")) });
        if (activa) {
          resumen.activaExistente++;
          return;
        }
      }
      const [creada] = await tx
        .insert(reservas)
        .values({
          idNodo: f.id_nodo,
          idNapNorm: f.nap ? normalizarIdNap(f.nap) : null,
          idNapOriginal: f.nap,
          puerto: null,
          estado: esActiva ? "activa" : "vencida",
          observacion: f.observacion.trim() || "(sin observación)",
          venceEn: f.fecha,
          origen: "legacy_import",
          creadaPor: actor!.id,
          cerradaEn: esActiva ? null : new Date(),
          cierreMotivo: esActiva ? null : "Vencida antes de la importación",
          legacySnapshot: f,
        })
        .returning({ id: reservas.id });
      await tx.insert(reservaEventos).values({ reservaId: creada!.id, tipo: "importada", actorId: actor!.id, datos: { desde, esActiva } });
      if (esActiva) resumen.activas++;
      else resumen.vencidas++;
    });
  }
  console.log(`${dryRun ? "[dry-run] " : ""}Importación desde ${ruta} (activas si fecha >= ${desde}):`);
  console.table(resumen);
  await appSql.end({ timeout: 2 });
}

if (process.argv[1]?.endsWith("import-reservas.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
