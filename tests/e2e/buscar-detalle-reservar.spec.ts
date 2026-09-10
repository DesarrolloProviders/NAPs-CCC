import { expect, test, type Page } from "@playwright/test";
import { NAP_PRUEBA, PUNTO_PRUEBA, USUARIOS, login } from "./helpers";

/**
 * Flujo principal contra servicios reales (PostGIS local, spi40 y OLT de la red interna).
 * Usa la NAP de referencia y deja el puerto como lo encontró (reserva → liberar).
 */
test.describe.configure({ mode: "serial" });

// Limpieza: borra las reservas creadas por esta corrida (identificadas por el abonado de prueba) para dejar la NAP como estaba.
test.afterAll(async () => {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });
  const url = process.env.APP_DATABASE_URL;
  if (!url) return;
  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { max: 1 });
  try {
    await sql`DELETE FROM reserva_eventos WHERE reserva_id IN (SELECT id FROM reservas WHERE observacion LIKE '%prueba e2e%' OR nro_abonado = '1004999')`;
    await sql`DELETE FROM reservas WHERE observacion LIKE '%prueba e2e%' OR nro_abonado = '1004999'`;
  } finally {
    await sql.end({ timeout: 2 });
  }
});

async function abrirDetalle(page: Page) {
  await page.goto(`/naps/${NAP_PRUEBA}`);
  await expect(page.getByRole("heading", { name: `NAP ${NAP_PRUEBA}` })).toBeVisible();
  // La tabla llega por streaming (spi40 tarda ~4 s): esperamos hidratación (los botones de acción son cliente).
  await expect(page.getByTestId("puerto-1")).toBeVisible({ timeout: 30_000 });
}

/** Primer puerto libre sin reserva ni acción pendiente. */
async function primerPuertoLibre(page: Page): Promise<number> {
  const filas = page.locator("[data-testid^=puerto-][data-estado=libre]");
  await expect(filas.first()).toBeVisible({ timeout: 30_000 });
  const testid = await filas.first().getAttribute("data-testid");
  return Number(testid!.replace("puerto-", ""));
}

test("búsqueda por coordenadas: lista y mapa con 19 NAPs, selección compartida", async ({ page }) => {
  await login(page, USUARIOS.admin);
  await page.getByLabel("Coordenadas (lat, lon)").fill(`${PUNTO_PRUEBA.lat}, ${PUNTO_PRUEBA.lon}`);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/lat=-26\.8419/);
  await expect(page.locator("[data-testid^=resultado-]")).toHaveCount(19);
  await expect(page.getByTestId(`resultado-${NAP_PRUEBA}`)).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("path.leaflet-interactive")).toHaveCount(19);

  await page.getByTestId("resultado-303-01-06-N08-1-E").click();
  await expect(page.locator(".leaflet-popup")).toContainText("303-01-06-N08-1-E");

  // Filtros por URL (localidad sin tildes)
  await page.goto(`/buscar?lat=${PUNTO_PRUEBA.lat}&lon=${PUNTO_PRUEBA.lon}&radio=500&disp=1&estado=I&loc=banda%20del%20rio%20sali`);
  await expect(page.locator("[data-testid^=resultado-]")).toHaveCount(13);
});

test("detalle: puertos con cliente/ONT y estado OLT diferido", async ({ page }) => {
  await login(page, USUARIOS.admin);
  await abrirDetalle(page);
  await expect(page.locator("[data-testid^=puerto-]")).toHaveCount(8);
  await expect(page.getByTestId("puerto-2")).toContainText("Herrera, Luisa");
  await expect(page.getByTestId("puerto-2")).toContainText("fcc0cc22c8e7");
  // La OLT puede tardar hasta ~30 s por ONT
  await expect(page.getByText(/Estado OLT consultado|No se pudo consultar la OLT/)).toBeVisible({ timeout: 90_000 });
});

test("ventas reserva un puerto libre; repetir falla; no ve liberar/instalar", async ({ page }) => {
  await login(page, USUARIOS.ventas);
  await abrirDetalle(page);
  const puerto = await primerPuertoLibre(page);

  await page.getByTestId(`reservar-${puerto}`).click();
  await page.getByLabel(/Observación/).fill("1004999 prueba e2e");
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(page.getByTestId(`puerto-${puerto}`)).toHaveAttribute("data-estado", "reservado", { timeout: 60_000 });
  await expect(page.getByTestId(`puerto-${puerto}`)).toContainText("1004999 prueba e2e");

  // Ventas no puede liberar ni instalar
  await expect(page.getByTestId(`liberar-${puerto}`)).toHaveCount(0);
  await expect(page.getByTestId(`instalar-${puerto}`)).toHaveCount(0);
  await expect(page.getByTestId(`reservar-${puerto}`)).toHaveCount(0);

  // Historial muestra la reserva
  await page.getByTestId(`historial-${puerto}`).click();
  await expect(page.getByRole("dialog")).toContainText("1004999 prueba e2e");
  await page.keyboard.press("Escape");
});

test("admin libera la reserva creada, instala y libera de nuevo; historial con 3 eventos", async ({ page }) => {
  await login(page, USUARIOS.admin);
  await abrirDetalle(page);
  const reservado = page.locator("[data-testid^=puerto-][data-estado=reservado]").first();
  await expect(reservado).toBeVisible({ timeout: 30_000 });
  const puerto = Number((await reservado.getAttribute("data-testid"))!.replace("puerto-", ""));

  // Liberar
  await page.getByTestId(`liberar-${puerto}`).click();
  await page.getByLabel(/Motivo/).fill("fin de prueba e2e");
  await page.getByRole("button", { name: "Liberar puerto" }).click();
  await expect(page.getByTestId(`puerto-${puerto}`)).toHaveAttribute("data-estado", "libre", { timeout: 60_000 });

  // Instalar sin reserva previa deja marca 'instalado'
  await page.getByTestId(`instalar-${puerto}`).click();
  await page.getByLabel("Número de abonado").fill("1004999");
  await page.getByRole("button", { name: "Confirmar instalación" }).click();
  await expect(page.getByTestId(`puerto-${puerto}`)).toHaveAttribute("data-estado", "instalado", { timeout: 60_000 });

  // Historial: reserva liberada + instalación
  await page.getByTestId(`historial-${puerto}`).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toContainText("Liberada");
  await expect(dialogo).toContainText("Instalada");
  await expect(dialogo).toContainText("abonado 1004999");
});
