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

test("with ?tv=1 a TV remote's arrows and OK reach a game and its controls; without it nothing changes", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("ArrowDown");
  expect(await page.evaluate(() => document.documentElement.classList.contains("tv"))).toBe(false);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  await page.goto("/?tv=1");
  await page.keyboard.press("ArrowDown"); // the first control gets the focus
  const first = await page.evaluate(() => (document.activeElement as HTMLElement).innerText);
  // Move until a game link has the focus, then OK opens it.
  for (let i = 0; i < 6 && !/snakes|ludo/i.test(await page.evaluate(() => (document.activeElement as HTMLElement).innerText)); i++) {
    await page.keyboard.press("ArrowDown");
  }
  expect(first.length).toBeGreaterThan(0);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/(snakes|ludo)\/$/);
  // Still TV mode in the game (the tab remembers it): the arrows reach its buttons.
  expect(await page.evaluate(() => document.documentElement.classList.contains("tv"))).toBe(true);
  await page.keyboard.press("ArrowDown");
  expect(await page.evaluate(() => /^(BUTTON|A|INPUT)$/.test(document.activeElement!.tagName) || document.activeElement!.hasAttribute("tabindex"))).toBe(true);
});
