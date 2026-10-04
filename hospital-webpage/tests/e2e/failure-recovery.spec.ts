import { test, expect, openBooking, verify, timeButtons, control } from './fixtures';
test('D1: availability failure recovers and disabled booking has reception fallback', async ({ page, clinic }) => {
  await openBooking(page, clinic);
  await verify(page);
  await page.route('**/api/v1/availability?**', route => route.fulfill({ status: 503,
    contentType: 'application/json', body: JSON.stringify({ error: { message: 'Fictional temporary outage' } }) }));
  await page.getByLabel('Date', { exact: true }).fill(clinic.next_day);
  await expect(page.getByText(/Fictional temporary outage/)).toBeVisible();
  await page.unroute('**/api/v1/availability?**');
  await page.getByLabel('Date', { exact: true }).fill(clinic.day);
  await expect(timeButtons(page).first()).toBeEnabled();
  await control('disable-whatsapp');
  await page.reload();
  await expect(page.getByText('Contact reception to book', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm appointment', exact: true })).toHaveCount(0);
});
