import Link from "next/link";
import { MapPinned } from "lucide-react";
import { NavLinks } from "@/components/layout/NavLinks";
import { UserMenu } from "@/components/layout/UserMenu";
import type { Actor } from "@/lib/auth/session";
import { puede } from "@/lib/auth/permissions";

export function AppShell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  const links = [
    { href: "/buscar" as const, label: "Buscar NAPs" },
    ...(puede(actor.rol, "usuarios") ? [{ href: "/admin/usuarios" as const, label: "Usuarios" }] : []),
  ];
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center gap-4 px-4">
          <Link href="/buscar" className="flex items-center gap-2 font-semibold">
            <MapPinned className="size-5 text-primary" aria-hidden />
            <span>NAPs CCC</span>
          </Link>
          <NavLinks links={links} />
          <div className="ml-auto">
            <UserMenu actor={actor} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-4">{children}</main>
    </div>
  );
}
