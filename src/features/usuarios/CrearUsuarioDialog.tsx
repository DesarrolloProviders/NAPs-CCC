"use client";

import { UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearUsuario } from "@/features/usuarios/actions";
import { crearUsuarioSchema } from "@/features/usuarios/schemas";
import { ETIQUETA_ROL, ROLES, type Rol } from "@/lib/auth/permissions";

export function CrearUsuarioDialog() {
  const [abierto, setAbierto] = useState(false);
  const [rol, setRol] = useState<Rol>("ventas");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [pendiente, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = crearUsuarioSchema.safeParse({
      nombre: form.get("nombre"),
      email: form.get("email"),
      password: form.get("password"),
      rol,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrores(errs);
      return;
    }
    setErrores({});
    startTransition(async () => {
      const r = await crearUsuario(parsed.data);
      if (r.ok) {
        toast.success(`Usuario ${parsed.data.email} creado`);
        setAbierto(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        render={
          <Button>
            <UserPlus className="size-4" aria-hidden />
            Nuevo usuario
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>El usuario podrá ingresar con su email y la contraseña que definas acá.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" required autoFocus />
            {errores.nombre ? <p className="text-xs text-destructive">{errores.nombre}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
            {errores.email ? <p className="text-xs text-destructive">{errores.email}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña (mínimo 10 caracteres)</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
            {errores.password ? <p className="text-xs text-destructive">{errores.password}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rol">Rol</Label>
            <Select value={rol} onValueChange={(v) => setRol(v as Rol)}>
              <SelectTrigger id="rol" className="w-full">
                <SelectValue>{ETIQUETA_ROL[rol]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ETIQUETA_ROL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? "Creando…" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
