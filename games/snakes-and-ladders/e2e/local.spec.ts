import { expect, test } from "@playwright/test";

test("two bots play a local game to the end", async ({ page }) => {
  // bot games are random in length: most take under a minute, a long one has taken over two
  test.setTimeout(330_000);
  await page.goto("/snakes/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // the first character is a player by default: one tap makes it a bot, so bots play both seats
  await page.getByRole("button", { name: /^mushroom: player/ }).click();
  await page.getByRole("button", { name: /^Board:/ }).click();
  await page.getByRole("button", { name: /quick doodle/ }).click();
  await page.getByRole("button", { name: "play!" }).click();
  await expect(page.getByRole("dialog", { name: /wins!/ })).toBeVisible({ timeout: 300_000 });
});
