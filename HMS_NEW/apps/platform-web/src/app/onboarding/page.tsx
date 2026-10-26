import { BRAND_NAME } from "../../lib/brand";
import CaptureAccount from "../components/capture-account";
import "./onboarding.css";
export const metadata = { title: ("Set up your account | " + BRAND_NAME), robots: { index: false, follow: false } };
export default function OnboardingPage() { return <CaptureAccount />; }
