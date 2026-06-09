import { test, expect } from "@playwright/test";

test("terminal boot shows initializing then opens dashboard", async ({ page }) => {
  // Mark the tour as already seen so the auto-tour is suppressed and we stay on the dashboard.
  await page.addInitScript(() => window.localStorage.setItem("noetrix.tour.v1", "1"));
  await page.goto("/terminal", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("INITIALIZING...")).toBeVisible();
  await page.waitForURL("**/terminal/dashboard", { timeout: 5000 });
  await expect(page.getByRole("heading", { name: /Protocol dashboard/i })).toBeVisible();
});

test("boot animation plays when entering a deep terminal route too", async ({ page }) => {
  // The boot gate lives in the terminal layout, so it plays on entry to ANY /terminal
  // route, not just /terminal. The tour-seen flag isolates the boot from the auto-tour.
  await page.addInitScript(() => window.localStorage.setItem("noetrix.tour.v1", "1"));
  await page.goto("/terminal/insights", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("INITIALIZING...")).toBeVisible();
});

test("boot does NOT replay when navigating between terminal pages", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("noetrix.tour.v1", "1"));
  await page.goto("/terminal/leaderboard", { waitUntil: "domcontentloaded" });
  // First entry: boot plays, then finishes.
  await expect(page.getByText("INITIALIZING...")).toBeVisible();
  await expect(page.getByText("INITIALIZING...")).toBeHidden({ timeout: 4000 });
  // Navigate within the terminal via the header nav (client-side; layout persists).
  await page.getByRole("link", { name: "Insights", exact: true }).first().click();
  await page.waitForURL("**/terminal/insights");
  // The boot (and its green flash) must NOT replay on internal navigation.
  await page.waitForTimeout(1300); // past where a stray boom would have fired
  await expect(page.getByText("INITIALIZING...")).toBeHidden();
});

test("default tour auto-starts after entering on the dashboard (navbar flow)", async ({ page }) => {
  // Clean slate: entering the terminal home (dashboard) auto-starts the default tour,
  // which navigates to the leaderboard walkthrough once the boot finishes.
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/terminal/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/terminal/leaderboard", { timeout: 9000 });
  await expect(page.getByRole("dialog", { name: /guided tour/i })).toBeVisible({ timeout: 8000 });
});

test("old leaderboard route redirects to terminal namespace", async ({ page }) => {
  await page.goto("/leaderboard", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/terminal/leaderboard", { timeout: 5000 });
});
