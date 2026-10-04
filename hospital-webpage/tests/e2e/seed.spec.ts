import { test, expect } from './fixtures';
test('seed: built website has an interactive entry', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
