import posthog from 'posthog-js';

export type AnalyticsConsent = 'granted' | 'denied' | 'pending';

export type PageFamily =
  | 'home'
  | 'departments'
  | 'department_detail'
  | 'doctors'
  | 'doctor_detail'
  | 'locations'
  | 'location_detail'
  | 'booking'
  | 'search'
  | 'faq'
  | 'blog_list'
  | 'blog_post'
  | 'legal_hub'
  | 'legal_doc'
  | 'info'
  | 'admin'
  | 'not_found'
  | 'unknown';

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';
export type DesignMode = 'original' | 'light';
export type Environment = 'development' | 'preview' | 'production';

export type BookingFieldGroup =
  | 'identity'
  | 'date_of_birth'
  | 'gender'
  | 'contact_verification'
  | 'other';

export type ResultCountBucket = '0' | '1-5' | '6-20' | '20+';

export interface StandardEventEnvelope {
  schema_version: 1;
  page_family: PageFamily;
  effective_design_mode: DesignMode;
  selected_design_mode: DesignMode;
  device_class: DeviceClass;
  environment: Environment;
  is_demo: true;
  timestamp: string;
}

export interface InspectorEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

const CONSENT_STORAGE_KEY = 'avocado_analytics_consent';

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Storage access may be blocked
  }
  return null;
}

function detectDeviceClass(): DeviceClass {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function detectEnvironment(): Environment {
  if (typeof window === 'undefined') return 'development';
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'development';
  if (hostname.includes('preview') || hostname.includes('staging') || hostname.includes('run.app')) {
    return 'preview';
  }
  return 'production';
}

// In-memory event log for QA and testing
const eventInspectorLog: InspectorEvent[] = [];

let isSdkInitialized = false;
let hasSdkEverInitialized = false;
let currentSelectedMode: DesignMode = 'light';
let currentEffectiveMode: DesignMode = 'light';
let currentPageFamily: PageFamily = 'home';

export function getAnalyticsConsent(): AnalyticsConsent {
  const storage = getStorage();
  const stored = storage?.getItem(CONSENT_STORAGE_KEY);
  if (stored === 'granted' || stored === 'denied') return stored;
  return 'pending';
}

export function setAnalyticsConsent(granted: boolean): void {
  const storage = getStorage();
  const consentVal: AnalyticsConsent = granted ? 'granted' : 'denied';
  try {
    storage?.setItem(CONSENT_STORAGE_KEY, consentVal);
  } catch {
    // Ignore storage quota errors
  }

  if (granted) {
    initPostHogSdkIfConsented();
  } else {
    // If revoked, reset and disable
    if (isSdkInitialized) {
      try {
        posthog.opt_out_capturing();
        posthog.reset();
      } catch {
        // Safe catch
      }
      isSdkInitialized = false;
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('avocado_consent_changed', { detail: { consent: consentVal } }));
  }
}

export function updateAnalyticsContext(context: {
  pageFamily?: PageFamily;
  selectedMode?: DesignMode;
  effectiveMode?: DesignMode;
}): void {
  if (context.pageFamily) currentPageFamily = context.pageFamily;
  if (context.selectedMode) currentSelectedMode = context.selectedMode;
  if (context.effectiveMode) currentEffectiveMode = context.effectiveMode;
}

function initPostHogSdkIfConsented(): void {
  if (isSdkInitialized || typeof window === 'undefined') return;
  if (getAnalyticsConsent() !== 'granted') return;

  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  const explicitlyEnabled = import.meta.env.VITE_POSTHOG_ENABLED === 'true';

  // Collection requires explicit deployment enablement, in every environment.
  if (!explicitlyEnabled) {
    return;
  }

  if (!apiKey) return;

  try {
    if (!hasSdkEverInitialized) {
      posthog.init(apiKey, {
        api_host: host,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        mask_all_element_attributes: true,
        mask_all_text: true,
        persistence: 'localStorage',
        advanced_disable_decide: true,
      });
      hasSdkEverInitialized = true;
    }
    // Re-grant after revocation must clear the SDK's persisted opt-out state.
    posthog.opt_in_capturing({ captureEventName: false });
    isSdkInitialized = true;
  } catch (err) {
    console.warn('[Analytics] PostHog initialization was prevented or blocked', err);
  }
}

function createEnvelope(): StandardEventEnvelope {
  return {
    schema_version: 1,
    page_family: currentPageFamily,
    effective_design_mode: currentEffectiveMode,
    selected_design_mode: currentSelectedMode,
    device_class: detectDeviceClass(),
    environment: detectEnvironment(),
    is_demo: true,
    timestamp: new Date().toISOString(),
  };
}

export function captureAnalyticsEvent(
  eventName: string,
  extraProperties: Record<string, unknown> = {}
): void {
  const consent = getAnalyticsConsent();
  // A returning visitor may already have consent; the banner is not shown again.
  if (consent === 'granted') initPostHogSdkIfConsented();
  const envelope = createEnvelope();
  const payload = { ...envelope, ...extraProperties };

  // Always record to the in-memory inspector for testability and inspection
  eventInspectorLog.push({
    event: eventName,
    properties: payload,
    timestamp: envelope.timestamp,
  });

  // Only dispatch network telemetry if explicitly consented
  if (consent === 'granted' && isSdkInitialized) {
    try {
      posthog.capture(eventName, payload);
    } catch {
      // Prevent network/telemetry errors from impacting the UI
    }
  }
}

// ── Specific Event Methods following POSTHOG_ANALYTICS_PLAN.md ──

let lastSettledViewKey = '';

export function trackPageView(pageFamily: PageFamily, entryChannel?: string): void {
  updateAnalyticsContext({ pageFamily });
  const viewKey = `${pageFamily}:${entryChannel || 'direct'}`;
  // Deduplicate rapid re-triggers from React StrictMode or immediate re-renders
  if (lastSettledViewKey === viewKey) return;
  lastSettledViewKey = viewKey;

  captureAnalyticsEvent('page_viewed', {
    entry_channel: entryChannel || 'direct',
  });
}

export function trackNavigation(navigationArea: 'header' | 'footer' | 'sidebar' | 'banner', destinationFamily: PageFamily): void {
  captureAnalyticsEvent('navigation_used', {
    navigation_area: navigationArea,
    destination_family: destinationFamily,
  });
}

export function trackDoctorProfileOpened(sourceFamily: PageFamily): void {
  captureAnalyticsEvent('doctor_profile_opened', {
    source_family: sourceFamily,
  });
}

export function trackBookingIntent(sourceFamily: PageFamily, ctaPlacement: string): void {
  captureAnalyticsEvent('booking_intent_clicked', {
    source_family: sourceFamily,
    cta_placement: ctaPlacement,
  });
}

export function trackBookingFlowStarted(sourceFamily: PageFamily, entryStep: number = 1): void {
  captureAnalyticsEvent('booking_flow_started', {
    source_family: sourceFamily,
    entry_step: entryStep,
  });
}

export function trackBookingStepViewed(step: 1 | 2 | 3): void {
  captureAnalyticsEvent('booking_step_viewed', { step });
}

export function trackBookingStepCompleted(step: 1 | 2 | 3): void {
  captureAnalyticsEvent('booking_step_completed', { step });
}

export function trackBookingValidationFailed(step: 1 | 2 | 3, fieldGroup: BookingFieldGroup): void {
  captureAnalyticsEvent('booking_validation_failed', {
    step,
    field_group: fieldGroup,
  });
}

export function trackBookingPreviewCompleted(entrySourceFamily: PageFamily = 'booking'): void {
  captureAnalyticsEvent('booking_preview_completed', {
    entry_source_family: entrySourceFamily,
  });
}

export function countToBucket(count: number): ResultCountBucket {
  if (count <= 0) return '0';
  if (count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  return '20+';
}

export function trackSearchUsed(
  searchSurface: 'hero' | 'care_search' | 'navbar' | 'search_filter' | 'search_page',
  resultCountBucket: ResultCountBucket
): void {
  captureAnalyticsEvent('search_used', {
    search_surface: searchSurface,
    result_count_bucket: resultCountBucket,
  });
}

export function trackContactIntent(sourceFamily: PageFamily, contactChannel: 'whatsapp' | 'phone' | 'email'): void {
  captureAnalyticsEvent('contact_intent_clicked', {
    source_family: sourceFamily,
    contact_channel: contactChannel,
  });
}

export function trackModeSwitched(previousMode: DesignMode, newMode: DesignMode): void {
  captureAnalyticsEvent('mode_switched', {
    previous_mode: previousMode,
    new_mode: newMode,
  });
}

// ── In-Memory Inspector access for automated test assertions ──

export function getEventInspectorLog(): ReadonlyArray<InspectorEvent> {
  return [...eventInspectorLog];
}

export function clearEventInspectorLog(): void {
  eventInspectorLog.length = 0;
  lastSettledViewKey = '';
}
