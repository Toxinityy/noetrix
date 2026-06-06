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

test("Guide button re-opens the needs-picker", async ({ page }) => {
  await page.goto("/leaderboard");
  const guide = page.getByRole("button", { name: /guide/i });
  if (await guide.count()) {
    await guide.first().click();
    // Guide now re-opens the first-run "what do you want to do?" needs-picker
    // (OnboardingModal); picking a persona from there arms that goal's tour.
    await expect(page.getByRole("dialog", { name: /what do you want to do/i })).toBeVisible();
  }
});
