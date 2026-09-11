import { expect, type Page } from "@playwright/test";

/** Credenciales de desarrollo: el admin del seed y una cuenta de rol "usuario" (en dev, ventas@ccc.local). */
export const USUARIOS = {
  admin: { email: process.env.E2E_ADMIN_EMAIL ?? "admin@ccc.local", password: process.env.E2E_ADMIN_PASSWORD ?? "Admin.naps.2026" },
  usuario: { email: process.env.E2E_USUARIO_EMAIL ?? "ventas@ccc.local", password: process.env.E2E_USUARIO_PASSWORD ?? "Ventas.naps.2026" },
} as const;

export const NAP_PRUEBA = "303-01-08-N08-1-E";
export const PUNTO_PRUEBA = { lat: -26.8419, lon: -65.1622 };

export async function login(page: Page, usuario: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(usuario.email);
  await page.getByLabel("Contraseña").fill(usuario.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/buscar/);
}
