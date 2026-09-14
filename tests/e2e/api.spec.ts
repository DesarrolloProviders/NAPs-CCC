import { expect, test } from "@playwright/test";
import { NAP_PRUEBA, USUARIOS, login } from "./helpers";

/** Superficie HTTP sin sesión: lo que un cliente anónimo de internet puede (y no puede) hacer. */
test.describe("API sin sesión", () => {
  test("el estado OLT exige sesión", async ({ request }) => {
    // Sin cookie, el proxy redirige a /login; el route handler por sí solo responde 401 (defensa doble).
    const r = await request.get(`/api/naps/${NAP_PRUEBA}/olt`, { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(r.headers()["location"]).toContain("/login");
    const conCookieInvalida = await request.get(`/api/naps/${NAP_PRUEBA}/olt`, {
      maxRedirects: 0,
      headers: { cookie: "naps.session_token=invalido" },
    });
    expect(conCookieInvalida.status()).toBe(401);
  });

  test("health superficial responde sin detalles internos", async ({ request }) => {
    const r = await request.get("/api/health");
    expect([200, 503]).toContain(r.status());
    const cuerpo = await r.json();
    expect(cuerpo).not.toHaveProperty("checks");
    expect(JSON.stringify(cuerpo)).not.toMatch(/192\.168|password|ECONNREFUSED/);
  });

  test("health profundo exige token o sesión de admin", async ({ request }) => {
    const r = await request.get("/api/health?deep=1");
    expect(r.status()).toBe(401);
  });

  test("los endpoints de suplantación y borrado de better-auth están apagados", async ({ request }) => {
    for (const ruta of ["/api/auth/admin/impersonate-user", "/api/auth/admin/remove-user", "/api/auth/delete-user"]) {
      const r = await request.post(ruta, { data: { userId: "x" } });
      expect(r.status(), ruta).toBe(404);
    }
  });

  test("las cabeceras de seguridad están presentes y X-Powered-By no", async ({ request }) => {
    const r = await request.get("/login");
    const h = r.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("geolocation=(self)");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-powered-by"]).toBeUndefined();
    expect(h["x-request-id"]).toBeTruthy();
  });
});

test.describe("API con sesión", () => {
  test("un usuario común puede ver el estado OLT pero no consultar el health profundo", async ({ page }) => {
    await login(page, USUARIOS.usuario);
    const deep = await page.request.get("/api/health?deep=1");
    expect(deep.status()).toBe(401);
  });

  test("el refresh del estado OLT se limita por usuario y NAP", async ({ page }) => {
    test.setTimeout(240_000);
    await login(page, USUARIOS.admin);
    const primero = await page.request.get(`/api/naps/${NAP_PRUEBA}/olt?refresh=1`, { timeout: 120_000 });
    expect(primero.ok()).toBe(true);
    expect((await primero.json()).throttled).toBe(false);
    const segundo = await page.request.get(`/api/naps/${NAP_PRUEBA}/olt?refresh=1`, { timeout: 120_000 });
    expect((await segundo.json()).throttled).toBe(true);
  });
});
