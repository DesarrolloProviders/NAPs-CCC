"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLinks({ links }: { links: { href: "/buscar" | "/admin/usuarios"; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex items-center gap-1">
      {links.map((l) => {
        const activo = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
              activo ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
