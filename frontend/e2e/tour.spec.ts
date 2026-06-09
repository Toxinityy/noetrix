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

test("entering with a pending persona tour auto-starts it after boot", async ({ page }) => {
  // Simulate clicking a persona card on the StartHere landing picker, which arms the
  // tour via sessionStorage. onboarded=1 isolates this from the default leaderboard tour.
  await page.addInitScript(() => {
    window.localStorage.setItem("noetrix.onboarded.v1", "1");
    window.sessionStorage.setItem("noetrix.tour.request", "alpha");
  });
  await page.goto("/terminal/insights", { waitUntil: "domcontentloaded" });
  // After the boot animation, the alpha (insights) spotlight tour auto-starts.
  await expect(page.getByRole("dialog", { name: /guided tour/i })).toBeVisible({ timeout: 10000 });
});
