import { test, expect } from './fixtures';
test('D2: phone navigation fits both designs, closes on Escape and restores focus', async ({ page }) => {
  test.setTimeout(90_000); // Includes 24 independent page/viewport combinations.
  for (const mode of ['original', 'light']) {
    await page.evaluate(value => localStorage.setItem('avocado_design_mode_v1', value), mode);
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const path of ['/', '/?page=results', '/?page=schedule&doctor=doc-1&booking_preview=true']) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
      await page.goto('/');
      const trigger = page.getByRole('button', { name: 'Open navigation menu' });
      await trigger.click();
      await expect(page.getByRole('dialog', { name: 'Explore Avocado' })).toBeVisible();
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Explore Avocado' })).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main navigation', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});
