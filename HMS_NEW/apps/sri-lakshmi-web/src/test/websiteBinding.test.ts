import { afterEach, expect, it, vi } from 'vitest';
import { createPublicBookingApi } from '../lib/publicBookingApi';

const runtime = window as Window & { HMS_WEBSITE?: { bookingSite: string } };
afterEach(() => { delete runtime.HMS_WEBSITE; vi.unstubAllGlobals(); });
it('uses this deployment’s tenant booking binding on the same origin without staff credentials', async () => {
  runtime.HMS_WEBSITE = { bookingSite: 'new-clinic' };
  const fetcher = vi.fn(async () => Response.json({ siteSlug: 'new-clinic', clinicName: 'New clinic', timezone: 'Asia/Kolkata', today: '2026-10-20', bookingUntil: '2026-11-19', doctors: [] }));
  vi.stubGlobal('fetch', fetcher);
  const api = createPublicBookingApi();
  expect(api.site).toBe('new-clinic');
  await api.catalog();
  expect(fetcher).toHaveBeenCalledWith('/public/v1/booking/new-clinic/catalog', expect.objectContaining({ credentials: 'omit' }));
});
