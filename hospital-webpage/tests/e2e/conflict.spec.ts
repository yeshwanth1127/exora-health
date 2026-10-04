import { test, expect, openBooking, verify, timeButtons, hold, control, type Snapshot } from './fixtures';
test('B3: two verified browsers cannot hold or book the same time', async ({ page, browser, clinic, baseURL }) => {
  await openBooking(page, clinic);
  await verify(page);
  const other = await browser.newContext({ baseURL });
  try {
    const second = await other.newPage();
    await openBooking(second, clinic);
    await verify(second, '919833333333');
    const staleTime = await timeButtons(second).first().innerText();
    await hold(page);
    await second.getByRole('button', { name: staleTime, exact: true }).click();
    await expect(second.getByText('Request could not complete', { exact: true })).toBeVisible();
    await expect(second.getByLabel('Patient’s full name')).toHaveCount(0);
    const state = await control<Snapshot>('snapshot');
    expect(state.holds.filter(h => h.status === 'active')).toHaveLength(1);
    expect(state.appointments).toHaveLength(0);
  } finally { await other.close(); }
});
