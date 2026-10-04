import { test, expect } from './fixtures';
test('A1: public routes, refresh, browser history and not-found recovery', async ({ page }) => {
  const failedAssets: string[] = [];
  page.on('response', response => {
    if (response.status() >= 400 && /\.(js|css|woff2)(\?|$)/.test(response.url())) failedAssets.push(response.url());
  });
  for (const path of ['/doctors', '/doctors/doc-1', '/departments', '/departments/cardiology',
    '/locations', '/insurance', '/insurance-pricing', '/how-it-works', '/contact', '/faq', '/privacy', '/?page=blog']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'We couldn’t find that page' })).toHaveCount(0);
  }
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.goto('/faq');
  await page.goto('/doctors');
  await page.goBack();
  await expect(page.getByRole('heading', { name: /Frequently Asked Questions/i })).toBeVisible();
  await page.goto('/not-a-real-page');
  await expect(page.getByRole('heading', { name: 'We couldn’t find that page' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'We couldn’t find that page' })).toHaveCount(0);
  expect(failedAssets).toEqual([]);
});
