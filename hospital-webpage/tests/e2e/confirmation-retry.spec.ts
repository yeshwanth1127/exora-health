import { test, expect, openBooking, verify, hold, control, type Snapshot } from './fixtures';
test('B3/D1: a lost confirmation response is recovered without a duplicate', async ({ page, clinic }) => {
  await openBooking(page, clinic);
  await verify(page);
  await hold(page);
  await page.getByLabel('Patient’s full name').fill('Fictional Retry Patient');
  let dropped = false;
  await page.route('**/api/v1/web/booking/appointments', async route => {
    if (route.request().method() === 'POST' && !dropped) {
      dropped = true;
      const committed = await route.fetch();
      expect(committed.status()).toBe(201);
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  await expect(page.getByText('Request could not complete', { exact: true })).toBeVisible();
  const original = (await control<Snapshot>('snapshot')).appointments[0];
  await page.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  await expect(page.getByText('Test booking saved', { exact: true })).toBeVisible();
  const state = await control<Snapshot>('snapshot');
  expect(state.appointments).toHaveLength(1);
  expect(state.appointments[0]).toMatchObject({ id: original.id, code: original.code, events: 1, reminders: 0 });
});
