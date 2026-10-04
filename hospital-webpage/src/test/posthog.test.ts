import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  trackPageView,
  trackBookingFlowStarted,
  trackBookingStepViewed,
  trackBookingStepCompleted,
  trackBookingValidationFailed,
  trackBookingPreviewCompleted,
  trackSearchUsed,
  trackContactIntent,
  trackNavigation,
  trackDoctorProfileOpened,
  trackBookingIntent,
  trackModeSwitched,
  countToBucket,
  getEventInspectorLog,
  clearEventInspectorLog,
  updateAnalyticsContext,
} from '../lib/posthog';

describe('PostHog Analytics Adapter (Privacy & Event Contract)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearEventInspectorLog();
    updateAnalyticsContext({
      pageFamily: 'home',
      selectedMode: 'light',
      effectiveMode: 'light',
    });
  });

  describe('Consent Lifecycle Gate', () => {
    it('defaults to pending consent on a clean session', () => {
      expect(getAnalyticsConsent()).toBe('pending');
    });

    it('updates consent to granted when accepted', () => {
      setAnalyticsConsent(true);
      expect(getAnalyticsConsent()).toBe('granted');
      expect(localStorage.getItem('avocado_analytics_consent')).toBe('granted');
    });

    it('updates consent to denied when declined or revoked', () => {
      setAnalyticsConsent(false);
      expect(getAnalyticsConsent()).toBe('denied');
      expect(localStorage.getItem('avocado_analytics_consent')).toBe('denied');
    });

    it('dispatches custom event avocado_consent_changed on state transition', () => {
      let dispatched = '';
      const listener = (e: Event) => {
        dispatched = (e as CustomEvent).detail?.consent;
      };
      window.addEventListener('avocado_consent_changed', listener);
      setAnalyticsConsent(true);
      window.removeEventListener('avocado_consent_changed', listener);

      expect(dispatched).toBe('granted');
    });
  });

  describe('Standard Event Envelope', () => {
    it('attaches standard schema, device_class, environment, and demo flags', () => {
      trackPageView('departments');
      const log = getEventInspectorLog();

      expect(log).toHaveLength(1);
      const entry = log[0];
      expect(entry.event).toBe('page_viewed');
      expect(entry.properties.schema_version).toBe(1);
      expect(entry.properties.is_demo).toBe(true);
      expect(entry.properties.page_family).toBe('departments');
      expect(['mobile', 'tablet', 'desktop']).toContain(entry.properties.device_class);
      expect(['development', 'preview', 'production']).toContain(entry.properties.environment);
    });

    it('deduplicates rapid consecutive identical page_viewed events', () => {
      trackPageView('home');
      trackPageView('home');
      const log = getEventInspectorLog();

      expect(log).toHaveLength(1);
    });

    it('records new event when settled route changes', () => {
      trackPageView('home');
      trackPageView('doctors');
      const log = getEventInspectorLog();

      expect(log).toHaveLength(2);
      expect(log[0].properties.page_family).toBe('home');
      expect(log[1].properties.page_family).toBe('doctors');
    });
  });

  describe('Privacy & Zero-PII Boundary Check', () => {
    it('strictly forbids personal health and contact data in all event payloads', () => {
      trackBookingFlowStarted('booking', 1);
      trackBookingStepViewed(2);
      trackBookingValidationFailed(2, 'contact_verification');
      trackBookingStepCompleted(2);
      trackBookingPreviewCompleted('booking');
      trackSearchUsed('care_search', '1-5');
      trackContactIntent('booking', 'whatsapp');

      const log = getEventInspectorLog();
      expect(log.length).toBeGreaterThan(0);

      // Verify no sensitive keys or raw input leaks across any event
      const forbiddenKeys = [
        'name',
        'phone',
        'email',
        'dob',
        'date_of_birth',
        'otp',
        'symptom',
        'health_issue',
        'query_text',
        'url',
        'full_url',
      ];

      for (const eventItem of log) {
        const props = eventItem.properties;
        for (const forbidden of forbiddenKeys) {
          expect(props).not.toHaveProperty(forbidden);
        }
      }
    });

    it('uses coarse allowed enums for validation failure field groups', () => {
      trackBookingValidationFailed(2, 'identity');
      trackBookingValidationFailed(2, 'contact_verification');
      trackBookingValidationFailed(2, 'date_of_birth');
      trackBookingValidationFailed(2, 'gender');

      const log = getEventInspectorLog();
      expect(log).toHaveLength(4);
      expect(log.map((e) => e.properties.field_group)).toEqual([
        'identity',
        'contact_verification',
        'date_of_birth',
        'gender',
      ]);
    });
  });

  describe('Booking Funnel Sequence Adherence', () => {
    it('produces the exact ordered events for a complete appointment booking journey', () => {
      // 1. User arrives in booking
      trackBookingFlowStarted('doctor_detail', 1);
      trackBookingStepViewed(1);

      // 2. Selects slot -> moves to Step 2
      trackBookingStepCompleted(1);
      trackBookingStepViewed(2);

      // 3. Encounters validation error
      trackBookingValidationFailed(2, 'contact_verification');

      // 4. Verifies OTP and completes Step 2
      trackBookingStepCompleted(2);
      trackBookingStepViewed(3);
      trackBookingPreviewCompleted('booking');

      const log = getEventInspectorLog();
      const eventNames = log.map((e) => e.event);

      expect(eventNames).toEqual([
        'booking_flow_started',
        'booking_step_viewed',
        'booking_step_completed',
        'booking_step_viewed',
        'booking_validation_failed',
        'booking_step_completed',
        'booking_step_viewed',
        'booking_preview_completed',
      ]);
    });
  });

  describe('Search & Result Count Bucketing', () => {
    it('accurately buckets doctor count into coarse privacy-safe buckets', () => {
      expect(countToBucket(0)).toBe('0');
      expect(countToBucket(-1)).toBe('0');
      expect(countToBucket(1)).toBe('1-5');
      expect(countToBucket(5)).toBe('1-5');
      expect(countToBucket(6)).toBe('6-20');
      expect(countToBucket(20)).toBe('6-20');
      expect(countToBucket(21)).toBe('20+');
      expect(countToBucket(100)).toBe('20+');
    });

    it('records search_used with surface and result_count_bucket', () => {
      trackSearchUsed('hero', '1-5');
      trackSearchUsed('care_search', '6-20');
      trackSearchUsed('search_filter', '20+');
      trackSearchUsed('search_page', '0');

      const log = getEventInspectorLog();
      expect(log).toHaveLength(4);
      expect(log.map((e) => e.properties.search_surface)).toEqual([
        'hero',
        'care_search',
        'search_filter',
        'search_page',
      ]);
      expect(log.map((e) => e.properties.result_count_bucket)).toEqual([
        '1-5',
        '6-20',
        '20+',
        '0',
      ]);
    });
  });

  describe('Navigation & Doctor Profile Discovery', () => {
    it('records navigation_used with navigation area and destination page family', () => {
      trackNavigation('header', 'departments');
      trackNavigation('footer', 'legal_hub');
      trackNavigation('sidebar', 'doctors');

      const log = getEventInspectorLog();
      expect(log).toHaveLength(3);
      expect(log[0].event).toBe('navigation_used');
      expect(log[0].properties.navigation_area).toBe('header');
      expect(log[0].properties.destination_family).toBe('departments');

      expect(log[1].properties.navigation_area).toBe('footer');
      expect(log[1].properties.destination_family).toBe('legal_hub');
    });

    it('records doctor_profile_opened with source_family', () => {
      trackDoctorProfileOpened('home');
      trackDoctorProfileOpened('search');
      trackDoctorProfileOpened('department_detail');

      const log = getEventInspectorLog();
      expect(log).toHaveLength(3);
      expect(log.map((e) => e.properties.source_family)).toEqual([
        'home',
        'search',
        'department_detail',
      ]);
    });
  });

  describe('Booking Intent & Placement Tracking', () => {
    it('captures booking_intent_clicked with source family and placement identifier', () => {
      trackBookingIntent('home', 'header_nav');
      trackBookingIntent('department_detail', 'department_hero');
      trackBookingIntent('home', 'why_choose_us_in_person');
      trackBookingIntent('home', 'home_doctor_card');
      trackBookingIntent('home', 'home_pricing_package');
      trackBookingIntent('home', 'whatsapp_widget');

      const log = getEventInspectorLog();
      expect(log).toHaveLength(6);
      expect(log[0].event).toBe('booking_intent_clicked');
      expect(log[0].properties.source_family).toBe('home');
      expect(log[0].properties.cta_placement).toBe('header_nav');

      expect(log[1].properties.source_family).toBe('department_detail');
      expect(log[1].properties.cta_placement).toBe('department_hero');

      expect(log[5].properties.cta_placement).toBe('whatsapp_widget');
    });
  });

  describe('Contact Intent & Channel Tracking', () => {
    it('records contact_intent_clicked with channel and source page family', () => {
      trackContactIntent('home', 'whatsapp');
      trackContactIntent('home', 'phone');
      trackContactIntent('info', 'email');

      const log = getEventInspectorLog();
      expect(log).toHaveLength(3);
      expect(log.map((e) => e.properties.contact_channel)).toEqual([
        'whatsapp',
        'phone',
        'email',
      ]);
      expect(log.map((e) => e.properties.source_family)).toEqual([
        'home',
        'home',
        'info',
      ]);
    });
  });

  describe('Design Mode Preference Tracking', () => {
    it('records mode_switched with previous and new design modes', () => {
      trackModeSwitched('light', 'original');
      trackModeSwitched('original', 'light');

      const log = getEventInspectorLog();
      expect(log).toHaveLength(2);
      expect(log[0].event).toBe('mode_switched');
      expect(log[0].properties.previous_mode).toBe('light');
      expect(log[0].properties.new_mode).toBe('original');

      expect(log[1].properties.previous_mode).toBe('original');
      expect(log[1].properties.new_mode).toBe('light');
    });
  });
});
