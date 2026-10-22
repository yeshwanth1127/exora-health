import { BRAND_NAME } from "../../../lib/brand";
import OnboardingWelcome from '../../components/onboarding-welcome';
export const metadata={title:("Your workspace setup · " + BRAND_NAME),robots:{index:false,follow:false}};
export default function WorkspacePage(){return <OnboardingWelcome workspace/>}
