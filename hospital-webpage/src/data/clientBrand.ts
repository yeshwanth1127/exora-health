import { clientAsset } from './clientAssets';

export const hospitalLogo = clientAsset('2024/06/cropped-cropped-SRI-LAKSHMI-Super-Speciality-Hospital-Logo.-png-2.png');

// HMS uses the same-origin public booking API. Demo and the older live flow are explicit modes.
export const hmsBookingEnabled = () => !['demo', 'live'].includes(import.meta.env.VITE_BOOKING_MODE);
export const demoBookingEnabled = () => import.meta.env.VITE_BOOKING_MODE === 'demo';
