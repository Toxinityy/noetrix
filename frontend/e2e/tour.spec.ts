import { test, expect } from "@playwright/test";

test("first-visit tour auto-starts on /leaderboard and advances", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/terminal/leaderboard");
  // The leaderboard renders the data-tour anchors the spotlight targets.
  await expect(page.locator("[data-tour]").first()).toBeVisible();
  // Advancing/closing with the keyboard must not throw.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/terminal\/leaderboard/);
});

test("Guide button re-opens the needs-picker", async ({ page }) => {
  // Mark onboarding as already seen so the first-run modal does NOT auto-open. This
  // isolates the Guide button as the sole trigger: otherwise the auto-open modal's
  // full-screen backdrop (fixed inset-0) can intercept the Guide click under parallel
  // workers, making the test flaky (passes in isolation, fails in the full suite).
  await page.addInitScript(() => window.localStorage.setItem("noetrix.onboarded.v1", "1"));
  await page.goto("/terminal/leaderboard");
  const guide = page.getByRole("button", { name: /guide/i });
  await expect(guide.first()).toBeVisible();
  await guide.first().click();
  // Guide re-opens the first-run "what do you want to do?" needs-picker
  // (OnboardingModal); picking a persona from there arms that goal's tour.
  await expect(page.getByRole("dialog", { name: /what do you want to do/i })).toBeVisible();
});
