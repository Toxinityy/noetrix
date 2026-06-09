import { test, expect } from "@playwright/test";

const pages = [
  "/terminal/dashboard",
  "/terminal/leaderboard",
  "/terminal/insights",
  "/terminal/agent/1",
  "/terminal/try",
  "/terminal/pricing",
];

for (const path of pages) {
  test(`375px renders without horizontal overflow: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    // domcontentloaded, not networkidle: these pages poll live chain reads (+ a dev indexer), so the
    // network never goes idle and "networkidle" times out. Layout is settled by load; wait for the
    // header + main to be visible, then measure overflow.
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.locator("main").first().waitFor({ state: "visible" });
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
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#start-here")).toBeAttached();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
});

test("guided tour auto-starts on every entry until 'Don't show again'", async ({ page }) => {
  // Fresh context (no opt-out): the full essentials tour auto-starts after boot.
  await page.goto("/terminal/dashboard");
  const tour = page.getByRole("dialog", { name: /guided tour/i });
  await expect(tour).toBeVisible({ timeout: 10000 });
  await page.keyboard.press("Escape"); // skip closes it for now, but does NOT opt out
  await expect(tour).toBeHidden();
  // Reload: it auto-starts AGAIN — the tour shows on every entry, not just the first.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(tour).toBeVisible({ timeout: 10000 });
  // Opt out permanently via the "Don't show again" button.
  await page.getByRole("button", { name: /don't show again/i }).click();
  await expect(tour).toBeHidden();
  // Reload: now suppressed for good (opt-out flag persists in this context).
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500); // let the boot animation finish on reload
  await expect(page.getByRole("dialog", { name: /guided tour/i })).toBeHidden();
});
