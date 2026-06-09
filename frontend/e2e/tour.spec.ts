import { test, expect } from "@playwright/test";

test("the full essentials tour auto-starts on the dashboard and advances across pages", async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/terminal/dashboard", { waitUntil: "domcontentloaded" });
  // After the boot animation, the full walkthrough auto-starts on the dashboard (step 1).
  const tour = page.getByRole("dialog", { name: /guided tour/i });
  await expect(tour).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/terminal\/dashboard/);
  // Advancing past the dashboard step navigates to the leaderboard (cross-page step 2),
  // with the tour staying open the whole way.
  await page.keyboard.press("ArrowRight");
  await page.waitForURL("**/terminal/leaderboard", { timeout: 8000 });
  await expect(tour).toBeVisible();
  await page.keyboard.press("Escape");
});

test("entering with a pending persona tour auto-starts it after boot", async ({ page }) => {
  // Simulate clicking a persona card on the StartHere landing picker, which arms the
  // tour via sessionStorage. The opt-out flag isolates this from the default full essentials tour.
  await page.addInitScript(() => {
    window.localStorage.setItem("noetrix.tour.optout", "1");
    window.sessionStorage.setItem("noetrix.tour.request", "alpha");
  });
  await page.goto("/terminal/insights", { waitUntil: "domcontentloaded" });
  // After the boot animation, the alpha (insights) spotlight tour auto-starts.
  await expect(page.getByRole("dialog", { name: /guided tour/i })).toBeVisible({ timeout: 10000 });
});
