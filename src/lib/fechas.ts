import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/** Zona horaria del negocio. Todas las fechas se formatean acá. */
export const ZONA = "America/Argentina/Tucuman";

/** "9 sep 2026, 14:03" para timestamps. */
export function formatoFechaHora(d: Date): string {
  return format(new TZDate(d, ZONA), "d MMM yyyy, HH:mm", { locale: es });
}
