import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CrearUsuarioDialog } from "@/features/usuarios/CrearUsuarioDialog";
import { UsuariosTabla } from "@/features/usuarios/UsuariosTabla";
import { listarUsuarios } from "@/features/usuarios/actions";
import { puede } from "@/lib/auth/permissions";
import { getActorOrRedirect } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  const actor = await getActorOrRedirect();
  // 404 en vez de 403 para no revelar la ruta a quien no es admin.
  if (!puede(actor.rol, "usuarios")) notFound();
  const usuarios = await listarUsuarios();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Altas, roles y acceso. Usuario consulta NAPs y puertos; Administrador además gestiona usuarios.</p>
        </div>
        <CrearUsuarioDialog />
      </div>
      <div className="rounded-lg border">
        <UsuariosTabla usuarios={usuarios} actorId={actor.id} />
      </div>
    </div>
  );
}
