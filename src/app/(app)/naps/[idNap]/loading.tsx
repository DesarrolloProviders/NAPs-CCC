import { Skeleton } from "@/components/ui/skeleton";

export default function NapDetalleLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy="true" aria-label="Cargando NAP">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-96" />
        <div className="space-y-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}
