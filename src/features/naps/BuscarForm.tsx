"use client";

import { LocateFixed, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aQueryString, type BusquedaParams } from "@/features/naps/search-params";
import { estaEnTucuman, formatoCoordenadas, parseCoordenadas } from "@/lib/geo/parse-coordenadas";

interface Props {
  inicial: BusquedaParams | null;
  localidades: string[];
  radioMax: number;
  radioDefault: number;
}

const TODAS = "__todas__";
const ESTADO_TODOS = "__todos__";

export function BuscarForm({ inicial, localidades, radioMax, radioDefault }: Props) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [coordTexto, setCoordTexto] = useState(inicial ? formatoCoordenadas({ lat: inicial.lat, lon: inicial.lon }) : "");
  const [radio, setRadio] = useState(String(inicial?.radio ?? radioDefault));
  const [disp, setDisp] = useState(inicial?.disp ?? false);
  const [estado, setEstado] = useState<string>(inicial?.estado ?? ESTADO_TODOS);
  // La URL puede traer la localidad con otra capitalización o sin tildes: se muestra la versión canónica de la lista.
  const [loc, setLoc] = useState<string>(() => {
    if (!inicial?.loc) return TODAS;
    const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    return localidades.find((l) => norm(l) === norm(inicial.loc!)) ?? inicial.loc;
  });
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [geoCargando, setGeoCargando] = useState(false);

  function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setAviso(null);
    const c = parseCoordenadas(coordTexto);
    if (!c) {
      setError('Ingresá coordenadas válidas, por ejemplo "-26.8419, -65.1622" o pegá un link de Google Maps.');
      return;
    }
    const r = Number(radio);
    if (!Number.isFinite(r) || r < 10 || r > radioMax) {
      setError(`El radio debe estar entre 10 y ${radioMax} metros.`);
      return;
    }
    if (!estaEnTucuman(c)) setAviso("Las coordenadas están fuera de Tucumán: verificá que no estén invertidas (lat, lon).");
    const qs = aQueryString({
      lat: c.lat,
      lon: c.lon,
      radio: Math.round(r),
      disp,
      estado: estado === ESTADO_TODOS ? undefined : (estado as "I" | "P"),
      loc: loc === TODAS ? undefined : loc,
    });
    startTransition(() => router.replace(`/buscar?${qs}`));
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
        setCoordTexto(formatoCoordenadas({ lat: pos.coords.latitude, lon: pos.coords.longitude }));
      },
      () => {
        setGeoCargando(false);
        setError("No se pudo obtener la ubicación del dispositivo.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <form onSubmit={buscar} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_auto]" noValidate aria-label="Búsqueda de NAPs">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="coordenadas">Coordenadas (lat, lon)</Label>
          <div className="flex gap-2">
            <Input
              id="coordenadas"
              name="coordenadas"
              value={coordTexto}
              onChange={(e) => setCoordTexto(e.target.value)}
              placeholder="-26.8419, -65.1622 o link de Google Maps"
              autoComplete="off"
              inputMode="text"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "coordenadas-error" : undefined}
            />
            <Button type="button" variant="outline" size="icon" onClick={usarMiUbicacion} disabled={geoCargando} title="Usar mi ubicación">
              <LocateFixed className="size-4" aria-hidden />
              <span className="sr-only">Usar mi ubicación</span>
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="radio">Radio (metros)</Label>
          <Input id="radio" name="radio" type="number" min={10} max={radioMax} step={50} value={radio} onChange={(e) => setRadio(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="estado">Estado</Label>
          <Select value={estado} onValueChange={(v) => setEstado(v ?? ESTADO_TODOS)}>
            <SelectTrigger id="estado" className="w-full">
              <SelectValue>{estado === ESTADO_TODOS ? "Todas" : estado === "I" ? "Instaladas" : "Proyectadas"}</SelectValue>
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
          <Select value={loc} onValueChange={(v) => setLoc(v ?? TODAS)}>
            <SelectTrigger id="localidad" className="w-full">
              <SelectValue>{loc === TODAS ? "Todas" : loc}</SelectValue>
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
          <Checkbox id="disp" checked={disp} onCheckedChange={(v) => setDisp(v === true)} />
          <Label htmlFor="disp" className="font-normal">
            Solo NAPs con puertos disponibles
          </Label>
        </div>
      </div>
      <div className="flex items-end">
        <Button type="submit" className="w-full md:w-auto" disabled={pendiente}>
          <Search className="size-4" aria-hidden />
          {pendiente ? "Buscando…" : "Buscar"}
        </Button>
      </div>
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
