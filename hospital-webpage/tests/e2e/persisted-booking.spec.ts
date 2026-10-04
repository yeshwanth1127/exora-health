import { test, expect, openBooking, verify, book, staffLogin, control, type Snapshot } from './fixtures';
test('B1/C3: signed verification leads to one saved appointment visible to reception', async ({ page, clinic }) => {
  await openBooking(page, clinic);
  await verify(page);
  const receipt = await book(page, 'Fictional Persisted Patient', true);
  expect(receipt).toMatchObject({ name: 'Fictional Persisted Patient', status: 'confirmed',
    source: 'google_business', channel: 'web', reservation_status: 'booked',
    doctor: clinic.doctor, branch: clinic.branch, events: 1, reminders: 1 });
  await page.reload();
  await expect(page.getByText(receipt.code, { exact: true })).toBeVisible();
  await staffLogin(page);
  await page.locator('#desk-day').fill(clinic.day);
  await page.getByLabel('Find a booking').fill(receipt.code);
  await expect(page.getByRole('button', { name: 'Fictional Persisted Patient', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect.poll(async () => (await control<Snapshot>('snapshot')).appointments[0].status).toBe('checked_in');
  await page.reload();
  await page.locator('#desk-day').fill(clinic.day);
  await expect(page.getByRole('button', { name: 'Fictional Persisted Patient', exact: true })).toBeVisible();
  expect((await control<Snapshot>('snapshot')).appointments).toHaveLength(1);
});
