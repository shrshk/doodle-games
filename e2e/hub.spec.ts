import { expect, test } from "@playwright/test";

test("the hub lists both games and opens each under its own path", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Doodle Games");
  const games = page.locator(".hub-game");
  await expect(games).toHaveCount(2);

  await page.getByRole("link", { name: /ludo/ }).click();
  await expect(page).toHaveURL(/\/ludo\/$/);
  await expect(page.getByRole("heading", { name: "doodle ludo" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: /snakes & ladders/ }).click();
  await expect(page).toHaveURL(/\/snakes\/$/);
  await expect(page.getByRole("heading", { name: /doodle snakes/ })).toBeVisible();
});

test("each game's files and offline worker live under its path; the root worker retires the old one", async ({ request }) => {
  for (const game of ["snakes", "ludo"]) {
    const manifest = await (await request.get(`/${game}/manifest.webmanifest`)).json();
    expect([manifest.start_url, manifest.scope]).toEqual([`/${game}/`, `/${game}/`]);
    expect(await (await request.get(`/${game}/sw.js`)).text()).toContain("cache names carry the");
  }
  expect(await (await request.get("/sw.js")).text()).toContain("unregister()");
  expect((await request.get("/apple-touch-icon.png")).headers()["content-type"]).toBe("image/png");
});
