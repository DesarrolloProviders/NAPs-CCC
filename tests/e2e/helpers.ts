import { expect, type Page } from "@playwright/test";

/** Credenciales de desarrollo (seed-admin y usuario de prueba creado en la Fase 3). */
export const USUARIOS = {
  admin: { email: process.env.E2E_ADMIN_EMAIL ?? "admin@ccc.local", password: process.env.E2E_ADMIN_PASSWORD ?? "Admin.naps.2026" },
  ventas: { email: process.env.E2E_VENTAS_EMAIL ?? "ventas@ccc.local", password: process.env.E2E_VENTAS_PASSWORD ?? "Ventas.naps.2026" },
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
