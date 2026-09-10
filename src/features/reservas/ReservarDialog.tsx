"use client";

import { CalendarClock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reservarPuerto } from "@/features/reservas/actions";
import { reservarPuertoSchema } from "@/features/reservas/schemas";
import { formatoCorto, vencimientoEn } from "@/lib/fechas";

interface Props {
  idNap: string;
  idNodo: number;
  puerto: number;
  diasDefault: number;
  diasMax: number;
}

export function ReservarDialog({ idNap, idNodo, puerto, diasDefault, diasMax }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [dias, setDias] = useState(diasDefault);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = reservarPuertoSchema.safeParse({ idNap, idNodo, puerto, observacion: form.get("observacion"), diasVigencia: dias });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await reservarPuerto(parsed.data);
      if (r.ok) {
        toast.success(`Puerto ${puerto} reservado hasta ${formatoCorto(r.data.venceEn)}`);
        setAbierto(false);
        router.refresh();
      } else {
        setError(r.mensaje);
        toast.error(r.mensaje);
        if (r.codigo === "PUERTO_YA_RESERVADO" || r.codigo === "PUERTO_OCUPADO") router.refresh();
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button size="sm" variant="outline" data-testid={`reservar-${puerto}`} />}>
        <CalendarClock className="size-4" aria-hidden />
        Reservar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Reservar puerto {puerto}</DialogTitle>
            <DialogDescription>
              NAP {idNap}. Antes de guardar se vuelve a verificar en el sistema de abonados que el puerto siga libre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="observacion">Observación (número de abonado, cliente o motivo)</Label>
            <Input id="observacion" name="observacion" required autoFocus placeholder="Ej: 1004999 Pérez" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dias">Vigencia (días, máximo {diasMax})</Label>
            <Input id="dias" name="dias" type="number" min={1} max={diasMax} value={dias} onChange={(e) => setDias(Number(e.target.value))} />
            <p className="text-xs text-muted-foreground">
              Vence el {formatoCorto(vencimientoEn(Math.min(Math.max(1, dias || 1), diasMax)))} (inclusive).
            </p>
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
              {pendiente ? "Verificando y reservando…" : "Confirmar reserva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
