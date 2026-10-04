import { test, expect } from './fixtures';
test('D3: consent controls work and no fake patient sign-in is offered', async ({ page }) => {
  const preferences = page.getByRole('region', { name: 'Privacy and product analytics preferences' });
  await expect(preferences).toBeVisible();
  await preferences.getByRole('button', { name: 'Decline', exact: true }).click();
  await expect(preferences).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('avocado_analytics_consent'))).toBe('denied');
  await page.reload();
  await expect(preferences).toHaveCount(0);
  await page.evaluate(() => localStorage.removeItem('avocado_analytics_consent'));
  await page.reload();
  await preferences.getByRole('button', { name: 'Accept', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('avocado_analytics_consent'))).toBe('granted');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  // Patient accounts are not connected, so production builds offer no sign-in at all.
  const menu = page.getByRole('dialog', { name: 'Explore Avocado' });
  await expect(menu.getByRole('button', { name: 'Book an appointment' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Log in', exact: true })).toHaveCount(0);
  await page.goto('/?page=insurance');
  await expect(page.getByRole('link', { name: /Call reception/ })).toBeVisible();
  await expect(page.getByPlaceholder('Mobile Number or Patient ID')).toHaveCount(0);
  await page.goto('/talk/');
  await expect(page.getByText(/disabled|unavailable|not available|not enabled/i).first()).toBeVisible();
});
