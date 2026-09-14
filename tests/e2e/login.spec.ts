import { expect, test } from "@playwright/test";
import { USUARIOS, login } from "./helpers";

test.describe("autenticación", () => {
  test("sin sesión redirige a /login y conserva el destino", async ({ page }) => {
    await page.goto("/buscar?lat=-26.8419&lon=-65.1622");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("login incorrecto muestra error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USUARIOS.admin.email);
    await page.getByLabel("Contraseña").fill("clave-incorrecta-123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText(/incorrectos/i)).toBeVisible();
  });

  test("admin entra, ve Usuarios y puede cerrar sesión", async ({ page }) => {
    await login(page, USUARIOS.admin);
    await expect(page.getByRole("link", { name: "Usuarios" })).toBeVisible();
    await page.getByRole("button", { name: /Administrador/ }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("?next= hacia otro sitio no saca al usuario de la app (open redirect)", async ({ page }) => {
    await page.goto("/login?next=//evil.example/buscar");
    await page.getByLabel("Email").fill(USUARIOS.usuario.email);
    await page.getByLabel("Contraseña").fill(USUARIOS.usuario.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:3110\/buscar/);
  });

  test("?next= interno se respeta", async ({ page }) => {
    await page.goto("/login?next=%2Fbuscar%3Fradio%3D300");
    await page.getByLabel("Email").fill(USUARIOS.usuario.email);
    await page.getByLabel("Contraseña").fill(USUARIOS.usuario.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/buscar\?radio=300/);
  });

  test("un usuario común no ve Usuarios y recibe 404 en /admin/usuarios", async ({ page }) => {
    await login(page, USUARIOS.usuario);
    await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
    const r = await page.goto("/admin/usuarios");
    expect(r?.status()).toBe(404);
  });
});
