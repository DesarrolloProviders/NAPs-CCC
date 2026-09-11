"use client";

import { LocateFixed, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTADO_TODOS, TODAS, type Filtros } from "@/features/naps/filtros";
import { geocodificar, GeocodificadorError, pareceDireccion, textoPrecision, type DireccionGeocodificada } from "@/lib/geo/geocodificar";
import { estaEnTucuman, formatoCoordenadas, parseCoordenadas, type Coordenadas } from "@/lib/geo/parse-coordenadas";

interface Props {
  filtros: Filtros;
  onCambio: (parcial: Partial<Filtros>) => void;
  /** Dispara la búsqueda; el panel arma la URL con estos mismos filtros. */
  onBuscar: (c: Coordenadas) => void;
  localidades: string[];
  radioMax: number;
  pendiente: boolean;
}

export function BuscarForm({ filtros, onCambio, onBuscar, localidades, radioMax, pendiente }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [geoCargando, setGeoCargando] = useState(false);
  const [resolviendo, setResolviendo] = useState(false);
  /** Dirección que devolvió el geocodificador para el último texto buscado. */
  const [resuelta, setResuelta] = useState<DireccionGeocodificada | null>(null);

  function validarYBuscar(c: Coordenadas): void {
    const r = Number(filtros.radio);
    if (!Number.isFinite(r) || r < 10 || r > radioMax) {
      setError(`El radio debe estar entre 10 y ${radioMax} metros.`);
      return;
    }
    if (!estaEnTucuman(c)) {
      setAviso("El punto está fuera de Tucumán: verificá la dirección, o que las coordenadas no estén invertidas (lat, lon).");
    }
    onBuscar(c);
  }

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setAviso(null);

    const texto = filtros.coordTexto.trim();
    const c = parseCoordenadas(texto);
    if (c) {
      setResuelta(null);
      validarYBuscar(c);
      return;
    }

    // No son coordenadas: si tiene letras, se intenta como dirección (calle y número).
    if (!pareceDireccion(texto)) {
      setError("Ingresá una dirección (Córdoba 1083), coordenadas (-26.8419, -65.1622), un link de Google Maps, o hacé click en el mapa.");
      return;
    }

    setResolviendo(true);
    try {
      const hallada = await geocodificar(texto, { localidad: filtros.loc === TODAS ? null : filtros.loc });
      if (!hallada) {
        setResuelta(null);
        setError("No encontramos esa dirección. Probá agregando la localidad, escribiendo la calle completa, o marcá el punto en el mapa.");
        return;
      }
      setResuelta(hallada);
      validarYBuscar(hallada.coord);
    } catch (err) {
      setResuelta(null);
      setError(
        err instanceof GeocodificadorError ? err.message : "No se pudo resolver la dirección. Usá coordenadas o marcá el punto en el mapa.",
      );
    } finally {
      setResolviendo(false);
    }
  }

  function usarMiUbicacion() {
    if (!("geolocation" in navigator)) {
      setError("El navegador no permite obtener la ubicación.");
      return;
    }
    setGeoCargando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCargando(false);
        setResuelta(null);
        onCambio({ coordTexto: formatoCoordenadas({ lat: pos.coords.latitude, lon: pos.coords.longitude }) });
      },
      () => {
        setGeoCargando(false);
        setError("No se pudo obtener la ubicación del dispositivo.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const ocupado = pendiente || resolviendo;

  return (
    <form
      onSubmit={buscar}
      className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_auto]"
      noValidate
      aria-label="Búsqueda de NAPs"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="coordenadas">Dirección o coordenadas</Label>
          <div className="flex gap-2">
            <Input
              id="coordenadas"
              name="coordenadas"
              value={filtros.coordTexto}
              onChange={(e) => {
                setResuelta(null);
                onCambio({ coordTexto: e.target.value });
              }}
              placeholder="Córdoba 1083 · -26.8419, -65.1622 · link de Google Maps"
              autoComplete="off"
              inputMode="text"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "coordenadas-error" : resuelta ? "direccion-resuelta" : undefined}
            />
            <Button type="button" variant="outline" size="icon" onClick={usarMiUbicacion} disabled={geoCargando} title="Usar mi ubicación">
              <LocateFixed className="size-4" aria-hidden />
              <span className="sr-only">Usar mi ubicación</span>
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="radio">Radio (metros)</Label>
          <Input
            id="radio"
            name="radio"
            type="number"
            min={10}
            max={radioMax}
            step={50}
            value={filtros.radio}
            onChange={(e) => onCambio({ radio: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="estado">Estado</Label>
          <Select value={filtros.estado} onValueChange={(v) => onCambio({ estado: v ?? ESTADO_TODOS })}>
            <SelectTrigger id="estado" className="w-full">
              <SelectValue>{filtros.estado === ESTADO_TODOS ? "Todas" : filtros.estado === "I" ? "Instaladas" : "Proyectadas"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ESTADO_TODOS}>Todas</SelectItem>
              <SelectItem value="I">Instaladas</SelectItem>
              <SelectItem value="P">Proyectadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="localidad">Localidad</Label>
          <Select value={filtros.loc} onValueChange={(v) => onCambio({ loc: v ?? TODAS })}>
            <SelectTrigger id="localidad" className="w-full">
              <SelectValue>{filtros.loc === TODAS ? "Todas" : filtros.loc}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas</SelectItem>
              {localidades.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
          <Checkbox id="disp" checked={filtros.disp} onCheckedChange={(v) => onCambio({ disp: v === true })} />
          <Label htmlFor="disp" className="font-normal">
            Solo NAPs con puertos disponibles
          </Label>
        </div>
      </div>
      <div className="flex items-end">
        <Button type="submit" className="w-full md:w-auto" disabled={ocupado}>
          <Search className="size-4" aria-hidden />
          {resolviendo ? "Ubicando…" : pendiente ? "Buscando…" : "Buscar"}
        </Button>
      </div>
      {resuelta ? (
        <p
          id="direccion-resuelta"
          data-testid="direccion-resuelta"
          role="status"
          className="flex items-start gap-1.5 text-sm text-muted-foreground md:col-span-2"
        >
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Buscando en <strong className="font-medium text-foreground">{resuelta.etiqueta}</strong> ({formatoCoordenadas(resuelta.coord)})
            — {textoPrecision(resuelta.precision)}.
          </span>
        </p>
      ) : null}
      {error ? (
        <p id="coordenadas-error" role="alert" className="text-sm text-destructive md:col-span-2">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p role="status" className="text-sm text-amber-700 md:col-span-2">
          {aviso}
        </p>
      ) : null}
    </form>
  );
}
