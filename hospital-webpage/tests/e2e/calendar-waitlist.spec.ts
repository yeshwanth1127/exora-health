import { readFile } from 'node:fs/promises';
import { test, expect, openBooking, verify, book } from './fixtures';
test('C4: calendar matches the saved instant and waitlist requires consent', async ({ page, clinic }) => {
  await openBooking(page, clinic);
  await verify(page);
  const receipt = await book(page);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Add to calendar' }).click();
  const calendar = await readFile(await (await downloaded).path(), 'utf8');
  expect(calendar).toContain('UID:' + receipt.id + '@avocado-booking');
  expect(calendar).toContain('DTSTART:' + new Date(receipt.starts_at + (receipt.starts_at.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(receipt.starts_at) ? '' : 'Z')).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z');
  await page.reload();
  await page.getByLabel('Date', { exact: true }).fill(clinic.day);
  await page.getByLabel('Patient name for waitlist').fill('Fictional Waitlist Patient');
  await expect(page.getByRole('button', { name: 'Join waitlist for selected date' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /Request an offer for this doctor/ }).check();
  await page.getByRole('button', { name: 'Join waitlist for selected date' }).click();
  await expect(page.getByText(/Waitlist · Dr. Vikram Rao · waiting/)).toBeVisible();
});
