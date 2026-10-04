import { useEffect } from 'react';

/** Public website entry delegates booking authority and identity to the core backend. */
export function LiveBookingEntry({ doctorName }: { doctorName?: string }) {
  const query = new URLSearchParams(window.location.search);
  const destination = new URL('/book/', window.location.origin);
  for (const key of ['branch', 'source', 'doctor']) {
    const value = query.get(key);
    if (value) destination.searchParams.set(key, value);
  }
  if (doctorName && (query.has('doctor') || /\/(schedule|schedule-appointment)\/[^/]+/.test(window.location.pathname))) {
    destination.searchParams.delete('doctor');
    destination.searchParams.set('doctor_name', doctorName);
  }
  if (!doctorName && !query.has('doctor') && /\/(schedule|schedule-appointment)\/[^/]+/.test(window.location.pathname)) destination.searchParams.set('doctor', window.location.pathname.split('/')[2]);
  const href = destination.pathname + destination.search;
  useEffect(() => { window.location.replace(href); }, [href]);
  return <main className="mx-auto max-w-2xl px-6 py-16"><h1 className="text-2xl font-semibold">Opening clinic booking</h1><p className="mt-4">Choose current clinic availability and verify through WhatsApp.</p><a href={href} className="mt-6 inline-block underline">Continue to secure booking</a></main>;
}
