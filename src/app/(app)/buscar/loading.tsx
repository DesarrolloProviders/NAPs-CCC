import { Skeleton } from "@/components/ui/skeleton";

export default function BuscarLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy="true" aria-label="Cargando búsqueda">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-36 w-full" />
      <div className="grid flex-1 gap-4 lg:grid-cols-[380px_1fr]">
        <Skeleton className="h-[420px]" />
        <Skeleton className="h-[420px]" />
      </div>
    </div>
  );
}
