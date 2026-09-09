import { TZDate } from "@date-fns/tz";
import { addDays, format, isBefore, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

/** Zona horaria del negocio. Todas las fechas "de calendario" se calculan acá. */
export const ZONA = "America/Argentina/Tucuman";

/** Fecha de hoy (sin hora) en la zona del negocio. */
export function hoy(): Date {
  return startOfDay(new TZDate(Date.now(), ZONA));
}

/** Formato ISO de calendario (YYYY-MM-DD) para columnas `date`. */
export function aFechaIso(d: Date): string {
  return format(new TZDate(d, ZONA), "yyyy-MM-dd");
}

/** Parsea una columna `date` (YYYY-MM-DD) a Date en la zona del negocio. */
export function desdeFechaIso(iso: string): Date {
  const d = parseISO(iso);
  return new TZDate(d.getFullYear(), d.getMonth(), d.getDate(), ZONA);
}

/** Vencimiento de una reserva: hoy + días (inclusive: vigente mientras vence_en >= hoy). */
export function vencimientoEn(dias: number, desde: Date = hoy()): string {
  return aFechaIso(addDays(desde, dias));
}

/** true si la fecha de calendario ya pasó (es anterior a hoy). */
export function estaVencida(venceEnIso: string, referencia: Date = hoy()): boolean {
  return isBefore(desdeFechaIso(venceEnIso), startOfDay(referencia));
}

/** "09/09/2026" */
export function formatoCorto(iso: string): string {
  return format(desdeFechaIso(iso), "dd/MM/yyyy", { locale: es });
}

/** "9 sep 2026, 14:03" para timestamps. */
export function formatoFechaHora(d: Date): string {
  return format(new TZDate(d, ZONA), "d MMM yyyy, HH:mm", { locale: es });
}
