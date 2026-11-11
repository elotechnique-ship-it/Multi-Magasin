import { expect, test } from "@playwright/test";

test("la sonde de santé répond sans rien divulguer", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("/magasin exige une connexion", async ({ page }) => {
  await page.goto("/magasin");
  await expect(page).toHaveURL(/\/auth\/connexion\?next=%2Fmagasin/);
});

test("/superadmin exige une connexion", async ({ page }) => {
  await page.goto("/superadmin/dashboard");
  await expect(page).toHaveURL(/\/auth\/connexion/);
});

test("la redirection post-connexion refuse les URL externes", async ({ page }) => {
  await page.goto("/auth/connexion?next=https://evil.com");
  await expect(page.locator('input[name="next"]')).toHaveValue("/magasin");
});

test("les en-têtes de sécurité sont présents", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["referrer-policy"]).toBeTruthy();
});
