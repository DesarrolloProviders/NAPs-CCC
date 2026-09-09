"use client";

import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/auth-client";
import { ETIQUETA_ROL } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";

export function UserMenu({ actor }: { actor: Actor }) {
  const router = useRouter();
  async function salir() {
    await signOut();
    toast.success("Sesión cerrada");
    router.replace("/login");
    router.refresh();
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-2">
            <UserRound className="size-4" aria-hidden />
            <span className="hidden sm:inline">{actor.nombre}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="text-sm font-medium">{actor.nombre}</div>
          <div className="text-xs text-muted-foreground">{actor.email}</div>
          <div className="mt-1 text-xs text-muted-foreground">{ETIQUETA_ROL[actor.rol]}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={salir}>
          <LogOut className="size-4" aria-hidden />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
