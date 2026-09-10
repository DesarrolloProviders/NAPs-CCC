"use client";

import { Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { instalarPuerto } from "@/features/reservas/actions";
import { instalarPuertoSchema } from "@/features/reservas/schemas";

interface Props {
  idNap: string;
  idNodo: number;
  puerto: number;
  /** Observación de la reserva vigente, si la hay (para sugerir el abonado). */
  reservaObservacion?: string | null;
}

export function InstalarDialog({ idNap, idNodo, puerto, reservaObservacion }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const sugerido = reservaObservacion?.match(/\d{3,12}/)?.[0] ?? "";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = instalarPuertoSchema.safeParse({ idNap, idNodo, puerto, nroAbonado: form.get("nroAbonado"), observacion: form.get("observacion") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await instalarPuerto(parsed.data);
      if (r.ok) {
        toast.success(`Puerto ${puerto} marcado como instalado (abonado ${parsed.data.nroAbonado})`);
        setAbierto(false);
        router.refresh();
      } else {
        setError(r.mensaje);
        toast.error(r.mensaje);
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button size="sm" variant="outline" data-testid={`instalar-${puerto}`} />}>
        <Wrench className="size-4" aria-hidden />
        Instalar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Instalar en puerto {puerto}</DialogTitle>
            <DialogDescription>
              Confirma la instalación en la NAP {idNap} con el número de abonado. {reservaObservacion ? `Reserva vigente: "${reservaObservacion}".` : "El puerto no tiene reserva previa."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nroAbonado">Número de abonado</Label>
            <Input id="nroAbonado" name="nroAbonado" inputMode="numeric" required autoFocus defaultValue={sugerido} placeholder="Ej: 1004999" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="observacion">Observación (opcional)</Label>
            <Input id="observacion" name="observacion" placeholder="Ej: ONT instalada, señal OK" />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Confirmar instalación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
