import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/LoginForm";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await getSession();
  const { next } = await searchParams;
  const destino = typeof next === "string" && next.startsWith("/") ? next : "/buscar";
  if (session) redirect(destino as Route);

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">NAPs CCC</CardTitle>
          <CardDescription>Ingresá con tu usuario para consultar las NAPs y su disponibilidad.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={destino} />
        </CardContent>
      </Card>
    </main>
  );
}
