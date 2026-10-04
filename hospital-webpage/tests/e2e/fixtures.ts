import { test as base, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

export { expect };
export type Clinic = { doctor: string; doctor_name: string; branch: string; branch_slug: string; day: string; next_day: string; fee: number };
export type Snapshot = { appointments: Array<{ id: string; code: string; name: string; status: string; source: string; channel: string; reservation_status: string; starts_at: string; doctor: string; branch: string; events: number; reminders: number }>; holds: Array<{ id: string; status: string }> };
export async function control<T = unknown>(command: string, data: unknown = {}): Promise<T> {
  const config = JSON.parse(await readFile('.e2e/runtime.json', 'utf8'));
  const response = await fetch(config.control + '/' + command, { method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error(`Fixture ${command} failed: ${await response.text()}`);
  return response.json();
}
export const test = base.extend<{ clinic: Clinic }>({
  clinic: [async ({}, use) => { await use(await control<Clinic>('reset')); }, { auto: true }],
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    // Deny external requests: a test must never send analytics/provider traffic.
    await page.context().route('**/*', async route => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && url.hostname !== '127.0.0.1') await route.abort();
      else await route.continue();
    });
    await page.goto('/');
    await use(page);
    expect(errors, 'uncaught browser errors').toEqual([]);
  },
});
export async function openBooking(page: Page, clinic: Clinic) {
  await page.goto(`/book/?doctor=${clinic.doctor}&branch=${clinic.branch}&source=google_business`);
  await expect(page.getByRole('heading', { name: 'Book your clinic visit' })).toBeVisible();
  await page.getByLabel('Date', { exact: true }).fill(clinic.day);
}
export async function verify(page: Page, sender = '919811111111') {
  await page.getByLabel('WhatsApp number with country code').fill(sender);
  await page.getByRole('checkbox', { name: /Use this number for verification/ }).check();
  await page.getByRole('button', { name: 'Prepare verification message' }).click();
  const href = await page.getByRole('link', { name: 'Open WhatsApp and send verification' }).getAttribute('href');
  await control('verify', { sender, text: new URL(href!).searchParams.get('text') });
  await page.getByRole('button', { name: 'I sent it · Check verification' }).click();
  await expect(page.getByText('Number verified. Select an available time above.')).toBeVisible();
}
export function timeButtons(page: Page) { return page.getByRole('button', { name: /\d{1,2}:\d{2}\s*(am|pm)/i }); }
export async function hold(page: Page) {
  await timeButtons(page).first().click();
  await expect(page.getByLabel('Patient’s full name')).toBeVisible();
}
export async function book(page: Page, name = 'Fictional E2E Patient', reminders = false) {
  await hold(page);
  await page.getByLabel('Patient’s full name').fill(name);
  if (reminders) await page.getByRole('checkbox', { name: /Send optional visit reminders/ }).check();
  await page.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  await expect(page.getByText('Test booking saved', { exact: true })).toBeVisible();
  return (await control<Snapshot>('snapshot')).appointments[0];
}
export async function staffLogin(page: Page, role = 'reception') {
  await page.goto('/staff/appointments');
  await page.getByLabel('Username', { exact: true }).fill('e2e.' + role);
  await page.getByLabel('Password', { exact: true }).fill('fictional-e2e-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Find a booking')).toBeVisible();
}
