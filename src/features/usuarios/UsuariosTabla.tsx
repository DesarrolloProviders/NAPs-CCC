"use client";

import { KeyRound, ShieldBan, ShieldCheck } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { activarUsuario, cambiarRol, resetearPassword } from "@/features/usuarios/actions";
import type { UsuarioVista } from "@/features/usuarios/schemas";
import { ETIQUETA_ROL, ROLES, type Rol } from "@/lib/auth/permissions";
import { formatoFechaHora } from "@/lib/fechas";

export function UsuariosTabla({ usuarios, actorId }: { usuarios: UsuarioVista[]; actorId: string }) {
  const [pendiente, startTransition] = useTransition();

  function ejecutar(promesa: Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const r = await promesa;
      if (r.ok) toast.success(okMsg);
      else toast.error(r.error ?? "Error");
    });
  }

  function onResetear(u: UsuarioVista) {
    const password = window.prompt(`Nueva contraseña para ${u.email} (mínimo 4 caracteres):`);
    if (password === null) return;
    ejecutar(resetearPassword({ userId: u.id, password }), "Contraseña actualizada");
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Alta</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {usuarios.map((u) => {
          const esYo = u.id === actorId;
          return (
            <TableRow key={u.id} data-testid={`usuario-${u.email}`}>
              <TableCell className="font-medium">
                {u.nombre}
                {esYo ? <span className="ml-2 text-xs text-muted-foreground">(vos)</span> : null}
              </TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Select
                  value={u.rol}
                  onValueChange={(v) => ejecutar(cambiarRol({ userId: u.id, rol: v as Rol }), `Rol de ${u.email}: ${ETIQUETA_ROL[v as Rol]}`)}
                  disabled={pendiente || esYo}
                >
                  <SelectTrigger className="w-40" aria-label={`Rol de ${u.email}`}>
                    <SelectValue>{ETIQUETA_ROL[u.rol as Rol] ?? u.rol}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ETIQUETA_ROL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {u.activo ? <Badge variant="secondary">Activo</Badge> : <Badge variant="destructive">Desactivado</Badge>}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatoFechaHora(new Date(u.creadoEn))}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onResetear(u)} disabled={pendiente} title="Resetear contraseña">
                    <KeyRound className="size-4" aria-hidden />
                    <span className="sr-only">Resetear contraseña</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pendiente || esYo}
                    title={u.activo ? "Desactivar" : "Activar"}
                    onClick={() =>
                      ejecutar(activarUsuario({ userId: u.id, activo: !u.activo }), u.activo ? `${u.email} desactivado` : `${u.email} activado`)
                    }
                  >
                    {u.activo ? <ShieldBan className="size-4" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
                    <span className="sr-only">{u.activo ? "Desactivar" : "Activar"}</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
