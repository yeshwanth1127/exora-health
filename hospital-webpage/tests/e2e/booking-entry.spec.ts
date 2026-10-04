import { test, expect } from './fixtures';
test('A2: real booking redirects preserve clinician, clinic and source in both designs', async ({ page, clinic }) => {
  test.setTimeout(60_000); // Multiple public entry points and two designs.
  for (const mode of ['original', 'light']) {
    await page.evaluate(value => localStorage.setItem('avocado_design_mode_v1', value), mode);
    for (const path of ['/schedule/doc-1', '/schedule-appointment/doc-1', '/?page=schedule&doctor=doc-1']) {
      await page.goto(path + (path.includes('?') ? '&' : '?') + 'branch=indiranagar&source=google_business');
      await expect(page).toHaveURL(/\/book\/\?/);
      await expect(page.getByRole('heading', { name: 'Book your clinic visit' })).toBeVisible();
      expect(new URL(page.url()).searchParams.get('source')).toBe('google_business');
      expect(new URL(page.url()).searchParams.get('branch')).toBe('indiranagar');
      await expect(page.getByRole('combobox', { name: 'Doctor', exact: true })).toContainText(clinic.doctor_name);
    }
  }
  await page.goto('/');
  await page.getByRole('banner').getByRole('button', { name: 'Book now', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meet your care team.' })).toBeVisible();
  await page.getByRole('button', { name: 'Book appointment', exact: true }).first().click();
  await expect(page).toHaveURL(/\/book\//);
  await expect(page.getByRole('combobox', { name: 'Doctor', exact: true })).toContainText(clinic.doctor_name);
  await page.goto('/?page=results');
  await page.getByRole('button', { name: /Book appointment/i }).first().click();
  await expect(page).toHaveURL(/\/book\//);
  await expect(page.getByRole('combobox', { name: 'Doctor', exact: true })).toContainText(clinic.doctor_name);
  await page.goto('/doctors/doc-1');
  await page.getByRole('button', { name: /Schedule Appointment/i }).first().click();
  await expect(page).toHaveURL(/\/book\//);
  await expect(page.getByRole('combobox', { name: 'Doctor', exact: true })).toContainText(clinic.doctor_name);
  await page.goto('/book?source=referral');
  await expect(page).toHaveURL(/\/book\/\?source=referral/);
  await expect(page.getByRole('combobox', { name: 'Doctor', exact: true })).toBeVisible();
  await page.goto('/book/?doctor_name=Missing%20Doctor');
  await expect(page.getByText(/website profile could not be matched/i)).toBeVisible();
  await page.goto('/schedule/non-existent-doctor');
  await expect(page).toHaveURL(/\/book\//);
  await expect(page.getByRole('combobox', { name: 'Doctor', exact: true })).toBeVisible();
  await expect(page.getByText(/website profile could not be matched/i)).toBeVisible();
  await page.goto('/?page=schedule&doctor=doc-1&booking_preview=true');
  await expect(page.getByText(/Sample walkthrough: dates/i)).toBeVisible();
});
