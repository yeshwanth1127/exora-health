# Specialist fields and feedback wave

Approved desktop components: Time picker, Phone input, Money input, Badge, Tooltip, Empty state, Skeleton, Copy button, Alert, Toast stack and Dialog. The user explicitly retained visual verification; no browser or screenshot verification was performed in this wave.

## Review locations

| Component | Application placement |
| --- | --- |
| Time picker | Shared start/end time ranges, weekly schedule windows, schedule-range planning |
| Phone input | Patient registration and demographics, family/contact phone, doctor work phone and messaging-contact form |
| Money input | Default service consultation fee and doctor fee override |
| Badge | Shared appointment/queue/consultation/staff Status labels |
| Tooltip | Labelled icon buttons and daily previous/next controls |
| Empty state | Shared successful-empty appointment, patient, queue and consultation views |
| Skeleton | Shared LoadingState and Resource loaders |
| Copy button | Booking result and detail confirmation codes, patient registry MRNs and generated teleconsultation link |
| Alert | Shared errors/hints/notices and uncertain-write recovery notice |
| Toast stack | Existing application toast callers through a result-message adapter; existing notification text and trigger conditions retained |
| Dialog | Existing leave/unsaved-change confirmation, including pending/unknown-write blocking state |

## Data and behavior boundaries

- Times remain HH:mm with one-minute precision and a 24-hour display; existing clinic timezone, validation and command callbacks remain. Native validation controls retain required-time constraints without replacing the source picker interactions.
- Phone callbacks carry E.164 strings; empty remains empty. Existing unsupported calling codes and values that the source country parser would truncate use the native field instead, preserving the exact original value. Country selection remains explicit. Native constraint controls retain required/disabled and E.164 checks; existing backend validation remains authoritative.
- Fees use integer paise and null for blank/default/unpriced. INR is fixed, limits match the existing six-digit rupee parser, and no zero is invented. Host tokens apply the previously approved 44px/18px compact field geometry while retaining source glyph/motion behavior.
- Status labels preserve the exact existing application text and tone mapping. Successful empty state, loading, initial failure and stale read-only content remain distinct.
- Copy feedback reports the actual clipboard result. No values are copied automatically.
- Toasts are emitted by the existing result/error callbacks. The adapter supports stable IDs, loading/error updates, dismissal and a bounded pre-mount buffer. It does not infer a successful save or provider outcome.
- The Arc Dialog replaces the leave-confirmation presentation. The leave state machine, original destination, keep-editing action, pending/unknown-write prohibition and recovery behavior remain unchanged. Other long-form modal/sheet workflows retain their current presentation in this wave.
- Alerts tied to recovery are persistent and retain the original recovery controls; they have no dismiss action.

## Automated verification

- TypeScript project compilation passed.
- 175 staff tests passed, including six new specialist-field/toast tests plus the existing permissions, leave-guard, unknown-outcome, dates, validation, command-recovery and provider-boundary suites.
- Production Vite build passed; the pre-existing large-chunk advisory remains.
- Integration lint has no errors; existing Fast Refresh, effect and render-purity warnings remain in the affected modules.
- `git diff --check` passed.

Visual layout, motion fidelity, pointer/keyboard behavior in the rendered UI and browser clipboard behavior await the user's review. Compilation and SSR tests are not a substitute for that review. No clinical, contact, pricing or provider data was submitted during this implementation.
