import { expect, test, type Page } from "@playwright/test";
import { NAP_PRUEBA, PUNTO_PRUEBA, USUARIOS, login } from "./helpers";

/**
 * La Content-Security-Policy de next.config.ts no debe bloquear nada de lo que la app usa de verdad:
 * tiles de OSM (img-src), Nominatim (connect-src), estilos inline de Leaflet, scripts de Next.
 */
function capturarViolaciones(page: Page): string[] {
  const violaciones: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violaciones.push(m.text());
  });
  page.on("pageerror", (e) => violaciones.push(`pageerror: ${e.message}`));
  return violaciones;
}

test("búsqueda con mapa y geocodificación sin violaciones CSP", async ({ page }) => {
  const violaciones = capturarViolaciones(page);
  await page.route("**/nominatim.openstreetmap.org/search**", (route) =>
    route.fulfill({ json: [{ lat: String(PUNTO_PRUEBA.lat), lon: String(PUNTO_PRUEBA.lon), place_rank: 30, display_name: "Prueba, Tucumán" }] }),
  );
  await login(page, USUARIOS.usuario);
  await page.goto(`/buscar?lat=${PUNTO_PRUEBA.lat}&lon=${PUNTO_PRUEBA.lon}&radio=500`);
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Dirección o coordenadas").fill("Belgrano 123");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByTestId("direccion-resuelta")).toBeVisible();

  expect(violaciones, violaciones.join("\n")).toEqual([]);
});

test("detalle de NAP sin violaciones CSP", async ({ page }) => {
  const violaciones = capturarViolaciones(page);
  await login(page, USUARIOS.usuario);
  await page.goto(`/naps/${NAP_PRUEBA}`);
  await expect(page.getByRole("heading", { name: `NAP ${NAP_PRUEBA}` })).toBeVisible();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 30_000 });
  expect(violaciones, violaciones.join("\n")).toEqual([]);
});
