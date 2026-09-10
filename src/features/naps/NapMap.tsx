"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { COLOR_NIVEL, ETIQUETA_NIVEL, nivelDisponibilidad } from "@/features/naps/colores";
import { formatoMetros } from "@/lib/geo/formato";
import type { NapResumen } from "@/lib/gis/schema";

export interface NapMapProps {
  centro: { lat: number; lon: number };
  radio: number;
  naps: NapResumen[];
  seleccionada: string | null;
  onSeleccionar: (idNap: string) => void;
  onMoverPunto?: (lat: number, lon: number) => void;
  /** Modo detalle: sin círculo grande ni click para mover. */
  compacto?: boolean;
}

// Ícono del punto buscado como SVG inline: evita el problema de los PNG de Leaflet con bundlers.
const iconoPunto = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" aria-hidden="true">
    <path d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 36 14 36s14-11.7 14-22.1C28 6.2 21.7 0 14 0z" fill="#1d4ed8"/>
    <circle cx="14" cy="14" r="5.5" fill="#fff"/></svg>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -30],
});

function ClickParaMover({ onMoverPunto }: { onMoverPunto?: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMoverPunto?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Ajusta la vista cuando cambian centro/radio (nueva búsqueda). */
function AjustarVista({ centro, radio }: { centro: { lat: number; lon: number }; radio: number }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(centro.lat, centro.lon).toBounds(radio * 2.2);
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, centro.lat, centro.lon, radio]);
  return null;
}

/** Abre el popup de la NAP seleccionada desde la lista. */
function EnfocarSeleccion({ seleccionada, naps }: { seleccionada: string | null; naps: NapResumen[] }) {
  const map = useMap();
  useEffect(() => {
    if (!seleccionada) return;
    const n = naps.find((x) => x.idNap === seleccionada);
    if (!n) return;
    const actual = map.getBounds();
    if (!actual.contains([n.lat, n.lon])) map.panTo([n.lat, n.lon], { animate: true });
  }, [map, seleccionada, naps]);
  return null;
}

export default function NapMap({ centro, radio, naps, seleccionada, onSeleccionar, onMoverPunto, compacto = false }: NapMapProps) {
  const marcadores = useRef(new Map<string, L.CircleMarker>());
  const centroLatLng = useMemo(() => [centro.lat, centro.lon] as [number, number], [centro.lat, centro.lon]);

  useEffect(() => {
    if (!seleccionada) return;
    marcadores.current.get(seleccionada)?.openPopup();
  }, [seleccionada]);

  return (
    <MapContainer center={centroLatLng} zoom={16} className="h-full w-full" scrollWheelZoom aria-label="Mapa de NAPs">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <AjustarVista centro={centro} radio={radio} />
      <EnfocarSeleccion seleccionada={seleccionada} naps={naps} />
      {!compacto ? <ClickParaMover onMoverPunto={onMoverPunto} /> : null}

      {!compacto ? (
        <Circle center={centroLatLng} radius={radio} pathOptions={{ color: "#1d4ed8", weight: 1.5, fillOpacity: 0.06, dashArray: "6 4" }} interactive={false} />
      ) : null}
      <Marker position={centroLatLng} icon={iconoPunto}>
        <Popup>
          Punto buscado
          <br />
          {centro.lat.toFixed(6)}, {centro.lon.toFixed(6)}
        </Popup>
      </Marker>

      {naps.map((n) => {
        const nivel = nivelDisponibilidad(n);
        const activa = n.idNap === seleccionada;
        return (
          <CircleMarker
            key={n.fid}
            center={[n.lat, n.lon]}
            radius={activa ? 11 : 8}
            pathOptions={{ color: activa ? "#111827" : "#ffffff", weight: activa ? 3 : 1.5, fillColor: COLOR_NIVEL[nivel], fillOpacity: 0.95 }}
            ref={(ref) => {
              if (ref) marcadores.current.set(n.idNap, ref);
              else marcadores.current.delete(n.idNap);
            }}
            eventHandlers={{ click: () => onSeleccionar(n.idNap) }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <a href={`/naps/${encodeURIComponent(n.idNap)}`} className="font-semibold underline">
                  {n.idNap}
                </a>
                <div>{n.localidad ?? "Sin localidad"}</div>
                <div>
                  {n.estado === "P" ? "Proyectada" : `${n.disponibles ?? "?"} de ${n.puertos ?? "?"} puertos libres`} · {ETIQUETA_NIVEL[nivel]}
                </div>
                <div className="text-muted-foreground">a {formatoMetros(n.metros)}</div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
