import { expect, test, type Page } from "@playwright/test";

/** Roll or pick whenever this page may, until `stop` says enough; counts the picks it made. */
async function play(page: Page, stop: () => boolean) {
  const roll = page.getByRole("button", { name: /Roll the die/ });
  const pick = page.locator(".pick-target").first();
  let picks = 0;
  while (!stop()) {
    if (await page.getByRole("dialog").isVisible()) break;
    if (await pick.isVisible()) {
      if (await pick.click({ timeout: 500 }).then(() => true, () => false)) picks++;
    } else if (await roll.isVisible()) await roll.click({ timeout: 500 }).catch(() => undefined);
    await page.waitForTimeout(80);
  }
  return picks;
}

const roster = (page: Page) => page.locator(".roster-status").allTextContents();

test("two browsers make a room, join by link, play steps with picks, and see the same board", async ({ browser }) => {
  const ana = await (await browser.newContext()).newPage();
  const bo = await (await browser.newContext()).newPage();

  // Ana turns off "need a 6" so tokens come out at once and real picks happen early
  await ana.goto("/ludo/");
  await ana.locator(".house-rules summary").click();
  await ana.getByRole("switch", { name: /need a 6 to bring a token out/ }).click();
  await ana.getByRole("button", { name: /play with friends online/ }).click();
  await ana.getByLabel("your name").fill("Ana");
  await ana.getByRole("button", { name: "start a room" }).click();
  const code = (await ana.locator(".room-code-letters").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await expect(ana.getByText(/house rules \(1 changed\)/)).toBeVisible();

  // Bo comes in through the share link, and sits opposite Ana
  await bo.goto(`/ludo/join/${code}`);
  await expect(bo.locator(".room-code-letters")).toHaveText(code);
  await expect(ana.getByRole("button", { name: /owl, bottom right corner/ })).toBeVisible();

  // a quick reaction in the lobby pops up on the reacting player's seat for the other player
  await bo.getByRole("button", { name: "Quick reactions" }).click();
  await bo.getByRole("menuitem", { name: "yay!" }).click();
  await expect(ana.locator(".seat-bubble")).toHaveText("yay!");

  await expect(bo.getByRole("button", { name: "start!" })).toHaveCount(0);
  await ana.getByRole("button", { name: "start!" }).click();
  await expect(bo.getByRole("img", { name: "Ludo board" })).toBeVisible();

  // in the game too: the reactions button on the board sheet, a bubble on the other screen
  await ana.getByRole("button", { name: "Quick reactions" }).click();
  await ana.getByRole("menuitem", { name: "nice!" }).click();
  await expect(bo.locator("svg text", { hasText: "nice!" })).toBeVisible();

  // a refresh mid-game puts Bo back in the same seat
  await bo.reload();
  await expect(bo.getByRole("img", { name: "Ludo board" })).toBeVisible();
  await expect(bo.locator("svg.sheet text", { hasText: "(you)" })).toHaveCount(1);

  // play for a while: both sides roll and pick
  const until = Date.now() + 45_000;
  const stop = () => Date.now() > until;
  const [anaPicks, boPicks] = await Promise.all([play(ana, stop), play(bo, stop)]);
  expect(anaPicks + boPicks).toBeGreaterThan(0);

  // the two tables settle on the same board: every player's status line matches
  await expect.poll(async () => JSON.stringify(await roster(ana)) === JSON.stringify(await roster(bo)), { timeout: 15_000 }).toBe(true);
  expect((await roster(ana)).join(" ")).toMatch(/out|home/);
});
