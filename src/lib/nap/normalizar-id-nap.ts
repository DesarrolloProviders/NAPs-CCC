/**
 * Normaliza un código de NAP para comparaciones y claves.
 * El legacy mezcla '411-10-24', '047_02_33', ' 303-01-08-N08-1-E ' (con espacios sucios en PostGIS).
 *
 * Reglas: trim, mayúsculas, sin espacios internos, '_' → '-', guiones repetidos colapsados.
 * NO se usa para llamar a spi40: ahí va el `id_nap` exacto de PostGIS (solo trim).
 */
export function normalizarIdNap(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "-")
    .replace(/-{2,}/g, "-");
}

/** Formato aceptado en la URL /naps/[idNap]: letras, dígitos y guiones. */
export const ID_NAP_REGEX = /^[A-Z0-9-]{3,64}$/;

export function esIdNapValido(valor: string): boolean {
  return ID_NAP_REGEX.test(normalizarIdNap(valor));
}
