/** "85 m" | "1,2 km" */
export function formatoMetros(metros: number): string {
  if (!Number.isFinite(metros)) return "—";
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`;
}
