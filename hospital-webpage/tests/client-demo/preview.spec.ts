import { test, expect } from '@playwright/test';
import { doctors } from '../../src/data/doctors';
import { departments } from '../../src/data/departments';

async function ready(page: import('@playwright/test').Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const declineAnalytics = page.getByRole('button', { name: 'Decline', exact: true });
  if (await declineAnalytics.isVisible()) await declineAnalytics.click();
  await page.evaluate(async () => { await document.fonts.ready; [...document.images].forEach(img => img.loading = 'eager'); await Promise.all([...document.images].map(img => img.decode().catch(() => {}))); });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  const bad = await page.locator('img').evaluateAll(images => images.filter(img => !(img as HTMLImageElement).naturalWidth).map(img => (img as HTMLImageElement).src));
  expect(bad).toEqual([]);
}

test('both existing homepage modes show sourced content and load all images', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  for (const mode of ['original', 'light']) {
    await page.evaluate(value => localStorage.setItem('avocado_design_mode_v1', value), mode);
    await page.reload(); await ready(page);
    await expect(page.getByText('Dr. Sambashiva', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Diabetic Check Up', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'More checks', exact: true }).click();
    await expect(page.getByText('Antenatal Profile', { exact: true })).toBeVisible();
    await expect(page.getByText('₹3,199', { exact: true })).toBeVisible();
    if (mode === 'original') await expect(page.getByRole('region', { name: 'Medical Accreditations' }).locator('img')).toHaveCount(5);
    await expect(page.locator('img[src="/images/bangalore_real_map.svg"]')).toBeVisible();
    const gallery = page.locator('#hospital-gallery');
    await expect(gallery.locator('figure')).toHaveCount(5);
    expect(await gallery.evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('#blogs')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBeTruthy();
    await gallery.screenshot({ path: `research/sri-lakshmi/qa/${info.project.name}-${mode}-gallery.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `research/sri-lakshmi/qa/${info.project.name}-${mode}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('founder screen and remaining information routes load without errors', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/about/'); await ready(page);
  await page.getByRole('button', { name: 'From the founder', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('From the founder.');
  await ready(page);
  await page.screenshot({ path: `research/sri-lakshmi/qa/${info.project.name}-founder.png`, fullPage: true });
  await page.getByRole('button', { name: 'Our hospital story', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Care for the KR Puram community');
  await page.goto('/founder/'); await ready(page);
  for (const route of ['/locations/', '/locations/kr-puram/', '/locations/kaggadasapura/', '/locations/koramangala/', '/locations/mother-child/', '/contact/', '/insurance/', '/pricing/', '/terms/', '/privacy/']) {
    await page.goto(route); await ready(page);
  }
  expect(errors).toEqual([]);
});

test('About Us direct route, navigation and browser back work', async ({ page }, info) => {
  await page.goto('/about/'); await ready(page);
  await expect(page.getByText(/Founded in 2002 by Dr. Sambashiva/)).toBeVisible();
  await page.screenshot({ path: `research/sri-lakshmi/qa/${info.project.name}-about.png`, fullPage: true });
  await page.getByRole('button', { name: 'Sri Lakshmi Hospital home', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Find your hospital specialists');
  const menu = page.getByRole('button', { name: 'Open navigation menu' });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole('dialog').getByText('About Us', { exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Our hospital', exact: true }).click();
  } else await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'About Us', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Care for the KR Puram community');
  await page.goBack(); await expect(page.getByRole('heading', { level: 1 })).toContainText('Find your hospital specialists');
});

test('all sourced doctor and specialty detail routes are usable', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (const doctor of doctors) {
    await page.goto(`/doctors/${doctor.id}/`); await ready(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(doctor.name);
    await expect(page.getByText('Not published on the hospital website', { exact: true })).toBeVisible();
  }
  for (const department of departments) {
    await page.goto(`/departments/${department.id}/`); await ready(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(department.name);
  }
  expect(errors).toEqual([]);
});

test('client appointment flow reaches the sample confirmation in both designs', async ({ page }, info) => {
  test.setTimeout(60_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const backendRequests: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') || (path.startsWith('/book/') && request.resourceType() !== 'document')) backendRequests.push(request.url());
  });
  await page.goto('/');
  for (const mode of ['original', 'light']) {
    await page.evaluate(value => localStorage.setItem('avocado_design_mode_v1', value), mode);
    await page.goto('/'); await ready(page);
    await expect(page.getByRole('banner').getByRole('img', { name: 'Sri Lakshmi Hospital logo' })).toBeVisible();
    await expect(page.locator('footer').getByRole('img', { name: 'Sri Lakshmi Hospital logo' })).toBeVisible();
    await page.getByRole('banner').getByRole('button', { name: 'Book now', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Meet your care team.');
    await page.getByRole('button', { name: 'Book appointment', exact: true }).first().click();
    await ready(page);
    expect(new URL(page.url()).searchParams.get('booking_preview')).toBe('true');
    await expect(page.getByText('Dr. Ananditha', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /^\d{2}:\d{2} (AM|PM)$/ }).first().click();
    await expect(page.getByLabel('Legal full name')).toBeVisible();
    await page.getByRole('button', { name: 'Review visit details' }).click();
    await expect(page.getByText('Full name is required', { exact: true })).toBeVisible();
    await page.getByLabel('Legal full name').fill('Fictional Demo Patient');
    await page.getByLabel('Date of birth').fill('1990-01-01');
    await page.getByRole('radio', { name: 'Male', exact: true }).check();
    await page.locator('#patient-phone').fill('9000000000');
    await page.getByRole('button', { name: 'Try demo code', exact: true }).click();
    await page.getByRole('button', { name: 'Quick Auto-fill (884922)', exact: true }).click();
    await page.getByRole('button', { name: 'Review visit details' }).click();
    await expect(page.getByRole('heading', { name: 'Walkthrough complete', exact: true })).toBeVisible();
    await expect(page.getByText(/No appointment has been reserved/)).toBeVisible();
    await ready(page);
    await page.screenshot({ path: `research/sri-lakshmi/qa/${info.project.name}-${mode}-booking.png`, fullPage: true });

    // Deep links and refresh work without the formerly required query flag.
    await page.goto('/schedule/doc-2'); await ready(page);
    await expect(page.getByText('Dr. Sambashiva', { exact: true }).first()).toBeVisible();
    await page.reload(); await ready(page);
    await expect(page.getByRole('button', { name: /^\d{2}:\d{2} (AM|PM)$/ }).first()).toBeVisible();
    await page.goto('/book/?doctor=doc-2'); await ready(page);
    await expect(page.getByText('Dr. Sambashiva', { exact: true }).first()).toBeVisible();
    await page.goto('/book/?doctor_name=Dr.%20Sambashiva'); await ready(page);
    await expect(page.getByText('Dr. Sambashiva', { exact: true }).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
  expect(backendRequests).toEqual([]);
});

test('homepage photographs open community media and photo viewer supports keyboard dismissal', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await ready(page);
  await page.locator('#hospital-gallery').getByRole('button', { name: 'Explore photos and videos: Sri Lakshmi, KR Puram', exact: true }).click();
  await ready(page);
  expect(new URL(page.url()).searchParams.get('page')).toBe('community');
  await page.reload(); await ready(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Care connects');
  await expect(page.locator('#photo-library figure')).toHaveCount(12);
  await page.getByRole('button', { name: 'Community & events', exact: true }).click();
  await expect(page.locator('#photo-library figure')).toHaveCount(6);
  const trigger = page.getByRole('button', { name: 'View photo: Coming together as a community', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Hospital photo viewer' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toHaveText('Coming together as a community');
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('heading')).toHaveText('The Kaggadasapura team');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Inside the hospital', exact: true }).click();
  await expect(page.locator('#photo-library figure')).toHaveCount(6);
  await page.getByRole('button', { name: 'All photographs', exact: true }).click();
  await ready(page); await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `research/sri-lakshmi/qa/${info.project.name}-community.png`, fullPage: true });
  await page.goto('/community-events/'); await ready(page);
  await page.getByRole('button', { name: 'Facilities & technology', exact: true }).last().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Technology.');
  expect(new URL(page.url()).searchParams.get('page')).toBe('facilities');
  await page.reload(); await ready(page);
  await page.goBack(); await expect(page.getByRole('heading', { level: 1 })).toContainText('Care connects');
  expect(errors).toEqual([]);
});

test('official films mount the selected YouTube player and stop on selection changes', async ({ page }) => {
  // Validate our player interaction independently of YouTube availability or network challenges.
  await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Embedded player test fixture</body></html>' }));
  await page.goto('/community/'); await ready(page);
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play Our hospital story, with Dr. Sambashiva', exact: true }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/3HTtj5NBA4w?autoplay=1&rel=0');
  await expect(page.getByRole('link', { name: 'Watch on YouTube', exact: false })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=3HTtj5NBA4w');
  await page.getByRole('button', { name: /Doctor explains Understanding kidney stone treatment/ }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play Understanding kidney stone treatment', exact: true }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', /4jvl0J9NKpY/);
  await page.goto('/founder/'); await ready(page);
  await page.getByRole('button', { name: 'Play Our hospital story, with Dr. Sambashiva', exact: true }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', /3HTtj5NBA4w/);
  // The homepage showcase autoplays muted once in view (browsers block autoplay with sound).
  await page.goto('/'); await ready(page);
  await expect(page.locator('#showcase iframe')).toHaveCount(0);
  await page.locator('#showcase .aspect-video').scrollIntoViewIfNeeded();
  await expect(page.locator('#showcase iframe')).toHaveAttribute('src', /3HTtj5NBA4w\?autoplay=1&rel=0&mute=1/);
  await page.getByRole('button', { name: 'Next showcase reel', exact: true }).click();
  await expect(page.locator('#showcase iframe')).toHaveAttribute('src', /4jvl0J9NKpY\?autoplay=1&rel=0&mute=1/);
});

test('all packages, cashless information and equipment are accessible and accurately linked', async ({ page }, info) => {
  const packages = (await import('../../src/data/clientPackages')).clientPackages;
  await page.goto('/packages/'); await ready(page);
  await expect(page.locator('[data-package]')).toHaveCount(8);
  for (const item of packages) {
    const card = page.locator(`[data-package="${item.id}"]`);
    await expect(card.getByRole('heading')).toHaveText(item.name);
    await expect(card.getByText(`₹${item.price.toLocaleString('en-IN')}`, { exact: true })).toBeVisible();
    await expect(card.getByRole('link')).toHaveAttribute('href', 'tel:+919901711716');
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `research/sri-lakshmi/qa/${info.project.name}-packages.png`, fullPage: true });
  await page.getByRole('button', { name: 'How cashless treatment works', exact: true }).click();
  await ready(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cashless care, explained.');
  for (const heading of ['Verify your insurance', 'Prepare the documents', 'Request pre-authorization', 'Receive the planned care', 'Discharge & settlement']) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Does cashless mean everything is free?' }).click();
  await expect(page.getByText(/Deductibles, copays, excluded items/)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `research/sri-lakshmi/qa/${info.project.name}-cashless.png`, fullPage: true });
  await page.goto('/facilities/'); await ready(page);
  for (const heading of ['Philips FD10 cardiac cath lab', '100-watt Holmium laser', '10-bed intensive care unit', '10-bed dialysis unit', 'Modular operating theatre', 'Echo & ultrasound']) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `research/sri-lakshmi/qa/${info.project.name}-facilities.png`, fullPage: true });
  await page.getByRole('button', { name: 'Explore cardiology', exact: true }).click(); await ready(page);
  await expect(page.getByRole('heading', { name: 'Angioplasty & stenting', exact: true })).toBeVisible();
  await page.goto('/departments/urology/'); await ready(page);
  await expect(page.getByRole('heading', { name: '100-watt Holmium laser', exact: true })).toBeVisible();
});
