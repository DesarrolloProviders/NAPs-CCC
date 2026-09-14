import { expect, test, type Page } from "@playwright/test";
import { NAP_PRUEBA, PUNTO_PRUEBA, USUARIOS, login } from "./helpers";

/**
 * Flujo principal contra servicios reales (PostGIS local, spi40 y OLT de la red interna).
 * La app es de solo consulta: no escribe en ninguna base más que la de sesiones.
 */
test.describe.configure({ mode: "serial" });

async function abrirDetalle(page: Page) {
  await page.goto(`/naps/${NAP_PRUEBA}`);
  await expect(page.getByRole("heading", { name: `NAP ${NAP_PRUEBA}` })).toBeVisible();
  // La tabla llega por streaming (spi40 tarda ~4 s): esperamos hidratación (el estado OLT es cliente).
  await expect(page.getByTestId("puerto-1")).toBeVisible({ timeout: 30_000 });
}

test("el mapa se ve antes de buscar y el click sobre él dispara la búsqueda", async ({ page }) => {
  await login(page, USUARIOS.admin);
  // Sin búsqueda: mapa visible, sin punto marcado y con la invitación a hacer click.
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByTestId("sin-busqueda")).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(0);

  // El radio elegido en el formulario también se aplica al click.
  await page.getByLabel("Radio (metros)").fill("300");
  await page.locator(".leaflet-container").click({ position: { x: 400, y: 220 } });
  await expect(page).toHaveURL(/lat=-2[67]\.\d+&lon=-6[56]\.\d+&radio=300/);
  await expect(page.getByTestId("sin-busqueda")).toHaveCount(0);
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(1);
  await expect(page.getByLabel("Dirección o coordenadas")).not.toHaveValue("");
});

test("búsqueda por coordenadas: lista y mapa con 19 NAPs, selección compartida", async ({ page }) => {
  await login(page, USUARIOS.admin);
  await page.getByLabel("Dirección o coordenadas").fill(`${PUNTO_PRUEBA.lat}, ${PUNTO_PRUEBA.lon}`);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/lat=-26\.8419/);
  await expect(page.locator("[data-testid^=resultado-]")).toHaveCount(19);
  await expect(page.getByTestId(`resultado-${NAP_PRUEBA}`)).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("path.leaflet-interactive")).toHaveCount(19);

  await page.getByTestId("resultado-303-01-06-N08-1-E").click();
  await expect(page.locator(".leaflet-popup")).toContainText("303-01-06-N08-1-E");

  // Filtros por URL. Los tests corren contra el GIS real: `disponibles` y `estado` cambian con la sincronización del legacy,
  // así que no se fija una cantidad exacta; se verifica que el filtro se aplica (localidad sin tildes) y que descarta.
  await page.goto(`/buscar?lat=${PUNTO_PRUEBA.lat}&lon=${PUNTO_PRUEBA.lon}&radio=500&disp=1&estado=I&loc=banda%20del%20rio%20sali`);
  const filtrados = await page.locator("[data-testid^=resultado-]").count();
  expect(filtrados).toBeGreaterThan(0);
  expect(filtrados).toBeLessThanOrEqual(19);
  await page.goto(`/buscar?lat=${PUNTO_PRUEBA.lat}&lon=${PUNTO_PRUEBA.lon}&radio=500&loc=localidad%20inexistente`);
  await expect(page.locator("[data-testid^=resultado-]")).toHaveCount(0);
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

test("el detalle es de solo lectura: ni admin tiene acciones sobre los puertos", async ({ page }) => {
  await login(page, USUARIOS.admin);
  await abrirDetalle(page);
  await expect(page.getByRole("columnheader", { name: "Acciones" })).toHaveCount(0);
  for (const accion of ["reservar", "liberar", "instalar", "historial"]) {
    await expect(page.locator(`[data-testid^=${accion}-]`)).toHaveCount(0);
  }
  // Los estados posibles son solo los que informan spi40 y la OLT.
  const estados = await page.locator("[data-testid^=puerto-]").evaluateAll((filas) => filas.map((f) => f.getAttribute("data-estado")));
  expect(estados.every((e) => ["libre", "ocupado", "online"].includes(e ?? ""))).toBe(true);
});

test("búsqueda por dirección: geocodifica y busca en el radio de esa dirección", async ({ page }) => {
  // No se golpea Nominatim real en los tests: se intercepta con la respuesta que devuelve
  // para una dirección de Banda del Río Salí (el punto de prueba, 19 NAPs a 500 m).
  await page.route("**/nominatim.openstreetmap.org/search**", async (route) => {
    expect(route.request().url()).toContain("Tucum");
    await route.fulfill({
      json: [
        {
          lat: String(PUNTO_PRUEBA.lat),
          lon: String(PUNTO_PRUEBA.lon),
          place_rank: 30,
          display_name: "123, Belgrano, Banda del Río Salí, Departamento Cruz Alta, Tucumán, T4178, Argentina",
        },
      ],
    });
  });

  await login(page, USUARIOS.admin);
  await page.getByLabel("Dirección o coordenadas").fill("Belgrano 123, Banda del Rio Sali");
  await page.getByRole("button", { name: "Buscar" }).click();

  // Se informa qué dirección se resolvió y con qué precisión, y se busca en ese punto.
  await expect(page.getByTestId("direccion-resuelta")).toContainText("Banda del Río Salí");
  await expect(page.getByTestId("direccion-resuelta")).toContainText("altura exacta");
  await expect(page).toHaveURL(/lat=-26\.8419\d*&lon=-65\.1622/);
  await expect(page.locator("[data-testid^=resultado-]")).toHaveCount(19);
});

test("dirección inexistente: lo dice y no busca", async ({ page }) => {
  await page.route("**/nominatim.openstreetmap.org/search**", (route) => route.fulfill({ json: [] }));
  await login(page, USUARIOS.admin);
  await page.getByLabel("Dirección o coordenadas").fill("Calle que no existe 9999");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.locator("#coordenadas-error")).toContainText("No encontramos esa dirección");
  await expect(page.getByTestId("sin-busqueda")).toBeVisible();
});
