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

test("guided tour auto-starts on the FIRST dashboard entry only", async ({ page }) => {
  // Fresh context: the full essentials tour auto-starts after boot — once.
  // (Re-prompting on every entry modal-blocked returning users and, worse, the
  // auto-start navigates to the dashboard, hijacking deep links. First visit only;
  // the Guide button replays tours on demand.)
  await page.goto("/terminal/dashboard");
  const tour = page.getByRole("dialog", { name: /guided tour/i });
  await expect(tour).toBeVisible({ timeout: 10000 });
  await page.keyboard.press("Escape");
  await expect(tour).toBeHidden();
  // Reload: already onboarded — the tour must NOT re-open.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500); // let the boot animation finish on reload
  await expect(page.getByRole("dialog", { name: /guided tour/i })).toBeHidden();
});
