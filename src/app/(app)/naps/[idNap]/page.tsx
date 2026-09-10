import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPinned } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CLASE_NIVEL, ETIQUETA_NIVEL, nivelDisponibilidad } from "@/features/naps/colores";
import { NapMiniMapa } from "@/features/naps/NapMiniMapa";
import { aQueryString } from "@/features/naps/search-params";
import { obtenerPuertosConEstado } from "@/features/puertos/fusionar-puertos";
import { PuertosTabla } from "@/features/puertos/PuertosTabla";
import { getActorOrRedirect } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { formatoCoordenadas } from "@/lib/geo/parse-coordenadas";
import { obtenerNapPorCodigo } from "@/lib/gis/queries";
import { esIdNapValido } from "@/lib/nap/normalizar-id-nap";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/naps/[idNap]">): Promise<Metadata> {
  const { idNap } = await params;
  return { title: `NAP ${decodeURIComponent(idNap)}` };
}

export default async function NapDetallePage({ params }: PageProps<"/naps/[idNap]">) {
  const actor = await getActorOrRedirect();
  const { idNap } = await params;
  const codigo = decodeURIComponent(idNap);
  if (!esIdNapValido(codigo)) notFound();

  const nap = await obtenerNapPorCodigo(codigo);
  if (!nap) notFound();

  const resultado = await obtenerPuertosConEstado(nap.idNap);
  const nivel = nivelDisponibilidad(nap);
  const centro = { lat: nap.lat, lon: nap.lon };
  const verEnMapa = `/buscar?${aQueryString({ lat: nap.lat, lon: nap.lon, radio: 200, focus: nap.idNap })}` as Route;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="link" size="sm" className="h-auto p-0 text-muted-foreground" nativeButton={false} render={<Link href="/buscar" />}>
            <ArrowLeft className="size-4" aria-hidden />
            Volver a la búsqueda
          </Button>
          <h1 className="text-2xl font-semibold">NAP {nap.idNap}</h1>
          <p className="text-sm text-muted-foreground">
            {nap.localidad ?? "Sin localidad"}
            {nap.ubicacion ? ` · ${nap.ubicacion}` : ""} · {formatoCoordenadas(centro)}
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href={verEnMapa} />}>
          <MapPinned className="size-4" aria-hidden />
          Ver en el mapa
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Puertos</CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {resultado.error ? null : (
                  <Badge variant="outline" className="border-green-200 bg-green-100 text-green-800">
                    {resultado.libres} libre{resultado.libres === 1 ? "" : "s"} de {resultado.puertos.length}
                  </Badge>
                )}
                <Badge variant="outline" className={cn(CLASE_NIVEL[nivel])} title="Disponibilidad según QGIS (sincronización en lote)">
                  QGIS: {nap.disponibles ?? "?"} / {nap.puertos ?? "?"} · {ETIQUETA_NIVEL[nivel]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {resultado.error ? (
                <Alert variant="destructive">
                  <AlertTitle>Sin datos de puertos</AlertTitle>
                  <AlertDescription>
                    {resultado.error.mensaje}{" "}
                    <Link href={`/naps/${encodeURIComponent(nap.idNap)}` as Route} className="underline">
                      Reintentar
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : resultado.puertos.length === 0 ? (
                <p className="text-sm text-muted-foreground">El sistema de abonados no devolvió puertos para esta NAP.</p>
              ) : (
                <PuertosTabla idNap={nap.idNap} puertos={resultado.puertos} rol={actor.rol} diasDefault={env.RESERVA_DIAS_DEFAULT} diasMax={env.RESERVA_DIAS_MAX} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos de QGIS</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Estado</dt>
                <dd>{nap.estado === "I" ? "Instalada" : nap.estado === "P" ? "Proyectada" : "—"}</dd>
                <dt className="text-muted-foreground">Tipo</dt>
                <dd>{nap.tipo ?? "—"}</dd>
                <dt className="text-muted-foreground">Puertos</dt>
                <dd>{nap.puertos ?? "—"}</dd>
                <dt className="text-muted-foreground">OLT / PON</dt>
                <dd>
                  {nap.olt ?? "—"} / {nap.pon ?? "—"}
                </dd>
                <dt className="text-muted-foreground">Obra</dt>
                <dd>{nap.obra ?? "—"}</dd>
                <dt className="text-muted-foreground">Última modif.</dt>
                <dd>{nap.ultimaModificacion ?? "—"}</dd>
                {nap.observacion ? (
                  <>
                    <dt className="text-muted-foreground">Observación</dt>
                    <dd>{nap.observacion}</dd>
                  </>
                ) : null}
              </dl>
            </CardContent>
          </Card>
          <div className="h-64 overflow-hidden rounded-lg border">
            <NapMiniMapa nap={nap} />
          </div>
        </div>
      </div>
    </div>
  );
}
