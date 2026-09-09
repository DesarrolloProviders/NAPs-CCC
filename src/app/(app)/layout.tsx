import { AppShell } from "@/components/layout/AppShell";
import { getActorOrRedirect } from "@/lib/auth/session";

/** Layout de la zona autenticada: verifica la sesión REAL en el servidor (el proxy solo mira la cookie). */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const actor = await getActorOrRedirect();
  return <AppShell actor={actor}>{children}</AppShell>;
}
