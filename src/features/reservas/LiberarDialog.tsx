"use client";

import { Unlock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { liberarReserva } from "@/features/reservas/actions";

interface Props {
  idNap: string;
  reservaId: number;
  puerto: number;
  observacion: string;
}

export function LiberarDialog({ idNap, reservaId, puerto, observacion }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const motivo = String(new FormData(e.currentTarget).get("motivo") ?? "");
    startTransition(async () => {
      const r = await liberarReserva({ reservaId, motivo }, idNap);
      if (r.ok) {
        toast.success(`Puerto ${puerto} liberado`);
        setAbierto(false);
        router.refresh();
      } else {
        toast.error(r.mensaje);
        if (r.codigo === "RESERVA_NO_ACTIVA") router.refresh();
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button size="sm" variant="outline" data-testid={`liberar-${puerto}`} />}>
        <Unlock className="size-4" aria-hidden />
        Liberar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Liberar puerto {puerto}</DialogTitle>
            <DialogDescription>
              Se cancela la reserva vigente (&ldquo;{observacion}&rdquo;) de la NAP {idNap}. El puerto vuelve a quedar libre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Input id="motivo" name="motivo" autoFocus placeholder="Ej: el cliente desistió" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={pendiente}>
              {pendiente ? "Liberando…" : "Liberar puerto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
