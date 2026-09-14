"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth/auth-client";
import { destinoSeguro } from "@/lib/auth/destino-seguro";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const { error: err } = await signIn.email({ email, password });
    setCargando(false);
    if (err) {
      setError(
        err.status === 401 || err.status === 400
          ? "Email o contraseña incorrectos."
          : err.status === 403
            ? "La cuenta está deshabilitada. Contactá a un administrador."
            : (err.message ?? "No se pudo iniciar sesión."),
      );
      return;
    }
    toast.success("Sesión iniciada");
    router.replace(destinoSeguro(next) as "/buscar");
    router.refresh();
  }

  return (
    // method="post" es la red de seguridad: si el usuario envía el formulario antes de que
    // hidrate el JS, el navegador hace un POST y no filtra la contraseña en la query string.
    <form onSubmit={onSubmit} method="post" action="/login" className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus placeholder="usuario@ccc.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={4} />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={cargando}>
        {cargando ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
