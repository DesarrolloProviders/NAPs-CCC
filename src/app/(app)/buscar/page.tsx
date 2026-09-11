import type { Metadata } from "next";
import { ZodError } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BuscarPanel } from "@/features/naps/BuscarPanel";
import { buscarNaps, limitesBusqueda, listarLocalidades } from "@/features/naps/queries";
import { parsearBusqueda, type BusquedaParams } from "@/features/naps/search-params";
import { loggerDe } from "@/lib/logger";

export const metadata: Metadata = { title: "Buscar NAPs" };
export const dynamic = "force-dynamic";

const log = loggerDe("http");

export default async function BuscarPage({ searchParams }: PageProps<"/buscar">) {
  const sp = await searchParams;
  const limites = limitesBusqueda();

  let params: BusquedaParams | null = null;
  let errorParams: string | null = null;
  try {
    params = parsearBusqueda(sp, limites.radioMax);
  } catch (e) {
    errorParams = e instanceof ZodError ? "Los parámetros de la búsqueda no son válidos. Revisá coordenadas y radio." : "Búsqueda inválida.";
  }

  const [localidades, resultado, errorBusqueda] = await Promise.all([
    listarLocalidades().catch((e) => {
      log.error({ error: String(e) }, "listarLocalidades falló");
      return [] as string[];
    }),
    params ? buscarNaps(params).catch(() => null) : Promise.resolve(null),
    Promise.resolve(null as string | null),
  ]);
  const fallaGis = params !== null && resultado === null ? "No se pudo consultar la base de NAPs (PostGIS). Reintentá en unos segundos." : errorBusqueda;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Buscar NAPs</h1>
          <p className="text-sm text-muted-foreground">
            Ingresá una dirección o coordenadas, o hacé click en el mapa, para ver las NAPs cercanas ordenadas por distancia.
          </p>
        </div>
      </div>

      {errorParams ? (
        <Alert variant="destructive">
          <AlertTitle>Búsqueda inválida</AlertTitle>
          <AlertDescription>{errorParams}</AlertDescription>
        </Alert>
      ) : null}
      {fallaGis ? (
        <Alert variant="destructive">
          <AlertTitle>Sin conexión con la base de NAPs</AlertTitle>
          <AlertDescription>{fallaGis}</AlertDescription>
        </Alert>
      ) : null}

      <BuscarPanel
        inicial={params}
        hayResultado={resultado !== null}
        localidades={localidades}
        radioMax={limites.radioMax}
        radioDefault={limites.radioDefault}
        naps={resultado?.naps ?? []}
        truncado={resultado?.truncado ?? false}
        limite={resultado?.limite ?? limites.maxResultados}
      />
    </div>
  );
}
