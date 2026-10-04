import { test, expect } from './fixtures';
test('D1: restricted browser storage does not crash public routes or booking entry', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Fictional storage restriction', 'SecurityError'); } });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.goto('/doctors');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.goto('/schedule/doc-1');
  await expect(page).toHaveURL(/\/book\//);
  await expect(page.getByRole('heading', { name: 'Book your clinic visit' })).toBeVisible();
});
