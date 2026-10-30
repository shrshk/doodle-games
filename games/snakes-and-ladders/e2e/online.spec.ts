import { expect, test, type Page } from "@playwright/test";

/** Roll whenever it is this page's turn, until the game is over. */
async function playUntilWon(page: Page, stop: () => boolean) {
  const roll = page.getByRole("button", { name: /Roll the die/ });
  const win = page.getByRole("dialog");
  while (!stop()) {
    if (await win.isVisible()) return;
    if (await roll.isVisible()) await roll.click().catch(() => undefined);
    await page.waitForTimeout(100);
  }
}

test("two browsers make a room, join by code and link, and play it to the finish", async ({ browser }) => {
  const ana = await (await browser.newContext()).newPage();
  const bo = await (await browser.newContext()).newPage();

  // Ana opens a room on the small board
  await ana.goto("/snakes/");
  await ana.getByRole("button", { name: /^Board:/ }).click();
  await ana.getByRole("button", { name: /quick doodle/ }).click();
  await ana.getByRole("button", { name: /play with friends online/ }).click();
  await ana.getByLabel("your name").fill("Ana");
  await ana.getByRole("button", { name: "start a room" }).click();
  const code = (await ana.locator(".room-code-letters").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  // pasting the share link into the host's own tab keeps the host's seat (no second "you")
  await ana.goto(`/snakes/join/${code}`);
  await expect(ana.locator(".room-code-letters")).toHaveText(code);
  await expect(ana.getByText("you", { exact: true })).toHaveCount(1);
  await expect(ana.getByRole("button", { name: /start!|waiting for players/ })).toBeVisible();

  // Bo comes in through a share link from before the hub (/join/CODE): it still finds the room
  await bo.goto(`/join/${code}`);
  await expect(bo.locator(".room-code-letters")).toHaveText(code);
  await expect(ana.getByText("player", { exact: true })).toBeVisible();

  // a quick reaction in the lobby pops up on the reacting player's seat for the other player
  await bo.getByRole("button", { name: "Quick reactions" }).click();
  await bo.getByRole("menuitem", { name: "yay!" }).click();
  await expect(ana.locator(".seat-bubble")).toHaveText("yay!");

  // only the host has the start button
  await expect(bo.getByRole("button", { name: "start!" })).toHaveCount(0);
  await ana.getByRole("button", { name: "start!" }).click();
  await expect(bo.getByRole("img", { name: /board/ })).toBeVisible();

  // a refresh mid-game puts Bo back in the same seat
  await bo.reload();
  await expect(bo.getByRole("img", { name: /board/ })).toBeVisible();
  await expect(bo.locator("svg.sheet text", { hasText: "(you)" })).toHaveCount(1);

  let done = false;
  const winner = Promise.race([
    ana.getByRole("dialog").waitFor({ timeout: 150_000 }),
    bo.getByRole("dialog").waitFor({ timeout: 150_000 }),
  ]).finally(() => (done = true));
  await Promise.all([playUntilWon(ana, () => done), playUntilWon(bo, () => done), winner]);

  // both tables agree on who won
  await expect(ana.getByRole("dialog")).toBeVisible();
  await expect(bo.getByRole("dialog")).toBeVisible();
  const names = await Promise.all([ana, bo].map((p) => p.locator(".win-title").textContent()));
  expect(names.some((n) => n?.includes("you win!"))).toBe(true);

  // back to the room: the lobby comes back for both
  await ana.getByRole("button", { name: "back to the room" }).click();
  await expect(ana.locator(".room-code-letters")).toHaveText(code);
  await expect(bo.locator(".room-code-letters")).toHaveText(code);
});
