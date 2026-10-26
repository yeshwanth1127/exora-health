import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HmsBookingPage } from '../components/booking/HmsBookingPage';
import { createPublicBookingApi } from '../lib/publicBookingApi';
const catalog = { siteSlug: 'ndr-hospital', clinicName: 'NDR Hospital', timezone: 'Asia/Kolkata', today: '2026-10-14', bookingUntil: '2026-10-28', doctors: [{ slug: 'asha-rao', name: 'Dr Asha Rao', specialty: 'Medicine', acceptsVirtual: true, websiteIds: ['doc-1'], qualifications: [], bio: null, experienceYears: null, languages: [], photoUrl: null, departments: ['Medicine'] }] };
const slot = { startsAt: '2026-10-14T03:30:00Z', endsAt: '2026-10-14T03:45:00Z', feeMinor: 80000, slotToken: 'signed-slot' };
const receipt = { appointmentId: '00000000-0000-4000-8000-000000000001', confirmationCode: 'HMS-ABC123', status: 'confirmed', ...slot, clinicName: catalog.clinicName, doctorName: catalog.doctors[0].name, visitMode: 'in_person', timezone: catalog.timezone };
beforeEach(() => sessionStorage.clear()); afterEach(() => vi.unstubAllGlobals());
function mockFetch(book: () => Promise<Response> = async () => Response.json(receipt)) {
  const fn = vi.fn(async (url: string) => url.endsWith('/catalog') ? Response.json(catalog) : url.includes('/slots?') ? Response.json({ timezone: catalog.timezone, slots: [slot] }) : book());
  vi.stubGlobal('fetch', fn); return fn;
}
async function review() {
  fireEvent.click(await screen.findByRole('button', { name: /9:00 am.*800/i }));
  fireEvent.click(screen.getByRole('button', { name: /Continue to patient details/ }));
  fireEvent.change(screen.getByLabelText('Patient name'), { target: { value: 'Alex Example' } });
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9876543210' } });
  fireEvent.click(screen.getByRole('button', { name: /Review appointment/ }));
}
describe('HMS public appointment flow', () => {
  it('shows real available dates, waits for the persisted receipt, and never simulates OTP', async () => {
    let finish!: (response: Response) => void;
    const fetch = mockFetch(() => new Promise((resolve) => { finish = resolve; }));
    render(<HmsBookingPage requestedDoctorId="doc-1" onBack={() => {}} api={createPublicBookingApi('ndr-hospital')} />);
    expect(await screen.findByRole('button', { name: 'Wed, 14 Oct' })).toBeInTheDocument();
    await review();
    expect(screen.queryByText(/OTP|demo code/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm appointment' }));
    expect(screen.queryByRole('heading', { name: 'Appointment confirmed' })).not.toBeInTheDocument();
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.endsWith('/appointments'))).toBe(true));
    finish(Response.json(receipt));
    expect(await screen.findByRole('heading', { name: 'Appointment confirmed' })).toBeInTheDocument();
    expect(screen.getByText('HMS-ABC123')).toBeInTheDocument();
  });
  it('unmapped website doctor requires an explicit backend doctor, and virtual availability is requested by mode', async () => {
    const fetch = mockFetch();
    render(<HmsBookingPage requestedDoctorId="unmapped-legacy" onBack={() => {}} api={createPublicBookingApi('ndr-hospital')} />);
    expect(await screen.findByText(/not linked to a published booking profile/)).toBeInTheDocument();
    expect(screen.getByLabelText('Doctor')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Doctor'), { target: { value: 'asha-rao' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Teleconsultation' }));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('mode=virtual'))).toBe(true));
  });
  it('an empty backend roster never falls back to static website doctors or fabricated slots', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...catalog, doctors: [] })));
    render(<HmsBookingPage onBack={() => {}} api={createPublicBookingApi('ndr-hospital')} />);
    expect(await screen.findByText(/No doctors are published/)).toBeInTheDocument();
    expect(screen.queryByText('Dr Asha Rao')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue to patient details/ })).not.toBeInTheDocument();
  });
  it('uncertain booking freezes all choices and offers original-request recovery', async () => {
    mockFetch(async () => { throw Error('response lost'); });
    render(<HmsBookingPage requestedDoctorId="doc-1" onBack={() => {}} api={createPublicBookingApi('ndr-hospital')} />);
    await review(); fireEvent.click(screen.getByRole('button', { name: 'Confirm appointment' }));
    expect(await screen.findByRole('heading', { name: 'We need to confirm the original booking' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm appointment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit patient details' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Recover original booking' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'Appointment confirmed' })).not.toBeInTheDocument();
  });
});
