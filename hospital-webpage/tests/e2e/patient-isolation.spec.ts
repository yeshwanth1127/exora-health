import { test, expect, openBooking, verify, book, control, type Snapshot } from './fixtures';
test('D3: a second phone cannot see or cancel another patient visit; staff requires sign-in', async ({ page, browser, baseURL, clinic }) => {
  await openBooking(page, clinic);
  await verify(page);
  const receipt = await book(page);
  const other = await browser.newContext({ baseURL });
  try {
    const second = await other.newPage();
    await openBooking(second, clinic);
    await verify(second, '919844444444');
    await expect(second.getByText(receipt.code)).toHaveCount(0);
    await expect(second.getByText('No website appointments for this verified number.')).toBeVisible();
    const state = await second.request.get('/api/v1/web/booking/session');
    const csrf = (await state.json()).csrf_token;
    const denied = await second.request.post(`/api/v1/web/booking/appointments/${receipt.id}/cancel`, {
      headers: { Origin: baseURL!, 'X-Booking-CSRF': csrf }, data: { reason: 'Fictional foreign cancellation' } });
    expect(denied.status()).toBe(404);
    await second.goto('/admin');
    await expect(second).toHaveURL(/\/staff\/appointments/);
    await expect(second.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    expect((await control<Snapshot>('snapshot')).appointments[0].status).toBe('confirmed');
  } finally { await other.close(); }
});
