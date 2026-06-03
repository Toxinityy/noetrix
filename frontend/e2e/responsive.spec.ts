import { test, expect } from "@playwright/test";

const pages = ["/leaderboard", "/insights", "/agent/1"];

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
