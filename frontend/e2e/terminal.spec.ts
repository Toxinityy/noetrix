import { test, expect } from "@playwright/test";

test("terminal boot shows initializing then opens dashboard", async ({ page }) => {
  // onboarded=1 skips the first-run auto-tour so we land on (and stay on) the dashboard.
  await page.addInitScript(() => window.localStorage.setItem("noetrix.onboarded.v1", "1"));
  await page.goto("/terminal", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("INITIALIZING...")).toBeVisible();
  await page.waitForURL("**/terminal/dashboard", { timeout: 5000 });
  await expect(page.getByRole("heading", { name: /Protocol dashboard/i })).toBeVisible();
});

test("boot animation plays when entering a deep terminal route too", async ({ page }) => {
  // The boot gate lives in the terminal layout, so it plays on entry to ANY /terminal
  // route, not just /terminal. onboarded=1 isolates the boot from the auto-tour.
  await page.addInitScript(() => window.localStorage.setItem("noetrix.onboarded.v1", "1"));
  await page.goto("/terminal/insights", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("INITIALIZING...")).toBeVisible();
});

test("old leaderboard route redirects to terminal namespace", async ({ page }) => {
  await page.goto("/leaderboard", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/terminal/leaderboard", { timeout: 5000 });
});
