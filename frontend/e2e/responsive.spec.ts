import { test, expect } from "@playwright/test";

const pages = ["/leaderboard", "/insights", "/agent/1", "/try"];

for (const path of pages) {
  test(`375px renders without horizontal overflow: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2); // allow rounding
    await page.screenshot({
      path: `e2e/__screenshots__${path.replace(/\//g, "_")}_375.png`,
      fullPage: true,
    });
  });
}

test("landing shows the Start-here strip and has no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#start-here")).toBeAttached();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
});

test("first-run onboarding modal appears once then not again", async ({ page }) => {
  await page.goto("/leaderboard");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Just looking" }).click();
  await expect(dialog).toBeHidden();
  // Reload — the onboarded flag persists in this context, so the modal must not return.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("dialog")).toBeHidden();
});
