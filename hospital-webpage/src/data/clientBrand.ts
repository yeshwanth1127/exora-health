import { clientAsset } from './clientAssets';

export const hospitalLogo = clientAsset('2024/06/cropped-cropped-SRI-LAKSHMI-Super-Speciality-Hospital-Logo.-png-2.png');

// This client branch is a demo. Live mode still uses the existing authoritative backend.
export const demoBookingEnabled = () => import.meta.env.VITE_BOOKING_MODE !== 'live';
