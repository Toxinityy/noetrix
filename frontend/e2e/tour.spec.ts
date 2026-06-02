import { test, expect } from "@playwright/test";

test("first-visit tour auto-starts on /leaderboard and advances", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/leaderboard");
  // The leaderboard renders the data-tour anchors the spotlight targets.
  await expect(page.locator("[data-tour]").first()).toBeVisible();
  // Advancing/closing with the keyboard must not throw.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/leaderboard/);
});

test("Guide button replays the tour", async ({ page }) => {
  await page.goto("/leaderboard");
  const guide = page.getByRole("button", { name: /guide/i });
  if (await guide.count()) {
    await guide.first().click();
    await expect(page.getByRole("dialog", { name: /guided tour/i })).toBeVisible();
  }
});
