import type { NapResumen } from "@/lib/gis/schema";

/** Semáforo de disponibilidad compartido por lista y mapa. */
export type NivelDisponibilidad = "alta" | "media" | "nula" | "proyectada" | "desconocida";

export function nivelDisponibilidad(nap: Pick<NapResumen, "disponibles" | "estado">): NivelDisponibilidad {
  if (nap.estado === "P") return "proyectada";
  if (nap.disponibles === null || nap.disponibles === undefined) return "desconocida";
  if (nap.disponibles >= 4) return "alta";
  if (nap.disponibles >= 1) return "media";
  return "nula";
}

/** Colores hex para Leaflet (no dependen de Tailwind). */
export const COLOR_NIVEL: Record<NivelDisponibilidad, string> = {
  alta: "#16a34a",
  media: "#d97706",
  nula: "#dc2626",
  proyectada: "#6b7280",
  desconocida: "#94a3b8",
};

export const ETIQUETA_NIVEL: Record<NivelDisponibilidad, string> = {
  alta: "4 o más libres",
  media: "1 a 3 libres",
  nula: "Sin disponibilidad",
  proyectada: "Proyectada",
  desconocida: "Sin dato",
};

/** Clases Tailwind para badges en la lista. */
export const CLASE_NIVEL: Record<NivelDisponibilidad, string> = {
  alta: "bg-green-100 text-green-800 border-green-200",
  media: "bg-amber-100 text-amber-800 border-amber-200",
  nula: "bg-red-100 text-red-800 border-red-200",
  proyectada: "bg-gray-100 text-gray-700 border-gray-200",
  desconocida: "bg-slate-100 text-slate-700 border-slate-200",
};
