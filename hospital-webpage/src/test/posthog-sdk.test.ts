import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ init:vi.fn(), capture:vi.fn(), opt_in_capturing:vi.fn(), opt_out_capturing:vi.fn(), reset:vi.fn() }));
vi.mock('posthog-js', () => ({default:sdk}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();localStorage.clear();vi.stubEnv('VITE_POSTHOG_KEY','public-test-project-token');vi.stubEnv('VITE_POSTHOG_ENABLED','true')});
afterEach(()=>vi.unstubAllEnvs());
describe('PostHog persisted consent and SDK lifecycle',()=>{
 it('requires deployment enablement even when consent is saved',async()=>{vi.stubEnv('VITE_POSTHOG_ENABLED','false');localStorage.setItem('avocado_analytics_consent','granted');const a=await import('../lib/posthog');a.trackBookingFlowStarted('booking');expect(sdk.init).not.toHaveBeenCalled();expect(sdk.capture).not.toHaveBeenCalled()});
 it('does not initialize or capture before consent',async()=>{const a=await import('../lib/posthog');a.trackBookingFlowStarted('booking');expect(sdk.init).not.toHaveBeenCalled();expect(sdk.capture).not.toHaveBeenCalled()});
 it('initializes on the first event for an already consented returning visitor',async()=>{localStorage.setItem('avocado_analytics_consent','granted');const a=await import('../lib/posthog');a.trackBookingFlowStarted('booking');a.trackBookingStepViewed(1);expect(sdk.init).toHaveBeenCalledTimes(1);expect(sdk.capture).toHaveBeenCalledTimes(2);expect(sdk.opt_in_capturing).toHaveBeenCalledWith({captureEventName:false})});
 it('revokes immediately and re-grants without initializing the SDK twice',async()=>{const a=await import('../lib/posthog');a.setAnalyticsConsent(true);a.trackBookingFlowStarted('booking');a.setAnalyticsConsent(false);a.trackBookingStepViewed(1);expect(sdk.capture).toHaveBeenCalledTimes(1);expect(sdk.opt_out_capturing).toHaveBeenCalledTimes(1);expect(sdk.reset).toHaveBeenCalledTimes(1);a.setAnalyticsConsent(true);a.trackBookingStepViewed(2);expect(sdk.init).toHaveBeenCalledTimes(1);expect(sdk.opt_in_capturing).toHaveBeenCalledTimes(2);expect(sdk.capture).toHaveBeenCalledTimes(2)});
});
