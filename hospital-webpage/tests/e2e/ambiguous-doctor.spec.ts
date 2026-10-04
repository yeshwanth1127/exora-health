import { test, expect, control } from './fixtures';
test('A2: matching names must not silently select the wrong backend doctor', async ({ page, clinic }) => {
  await control('duplicate-name', { doctor: clinic.doctor });
  await page.goto('/book/?doctor_name=' + encodeURIComponent(clinic.doctor_name));
  await expect(page.getByText(/website profile could not be matched/)).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Doctor', exact: true })).not.toContainText(clinic.doctor_name);
});
