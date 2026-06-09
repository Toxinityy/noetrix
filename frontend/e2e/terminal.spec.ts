import { test, expect } from "@playwright/test";

test("terminal boot shows initializing then opens dashboard", async ({ page }) => {
  await page.goto("/terminal", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("INITIALIZING...")).toBeVisible();
  await page.waitForURL("**/terminal/dashboard", { timeout: 5000 });
  
  // Close first-run onboarding modal so the page isn't aria-hidden
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Just looking" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("heading", { name: /Protocol dashboard/i })).toBeVisible();
});

test("old leaderboard route redirects to terminal namespace", async ({ page }) => {
  await page.goto("/leaderboard", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/terminal/leaderboard", { timeout: 5000 });
});