import { BRAND_NAME } from "../../../lib/brand";
import OnboardingWelcome from '../../components/onboarding-welcome';
export const metadata={title:("Welcome · " + BRAND_NAME),robots:{index:false,follow:false}};
export default function WelcomePage(){return <OnboardingWelcome/>}
