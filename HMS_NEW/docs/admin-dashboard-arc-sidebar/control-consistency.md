# Desktop control consistency follow-up

Addresses the user's screenshots of the detached report date picker, mismatched field shapes and heights, duplicate doctor selector, consultation baseline differences and crowded header.

## Result

- Shared Input and Textarea use the Arc field skin, retaining native attributes, validation, input events and form semantics. Single-line controls are 44px high, have 18px corners and 12px horizontal padding. Textareas use the same radius/padding and retain their multiline height.
- Both shared Choice APIs now use one adapter: Arc Select for fixed lists, Arc Combobox for larger searchable entity sources. IDs, displayed context, empty placeholders, required/error/hint associations and existing authorization-filtered option lists are retained. Remaining direct application selects were migrated to the same adapter.
- Shared buttons render the actual Arc Button through Base UI's supported render binding. Native submit/disabled/link semantics and existing action handlers are retained. Calendar/navigation refresh controls now align at 44px.
- Appointment doctor selection exists only in the filter menu. Appointment and patient record searches use Arc SearchField, including clear/focus behavior. They remain record searches, not fake entity selections.
- Shared DayNavigator uses Arc DatePicker and Calendar; appointments, consultations, teleconsultations, queue and scheduling consumers inherit it. Previous/Next/Today and calendar-day strings retain clinic timezone/bounds. Native date/time form inputs elsewhere keep native form semantics while matching the same field geometry.
- Activity now has a single aligned row for Person, Record, Action and Date range. The duplicate Single day field is removed; the range picker supports one-day selections and Today. The range trigger fills its column, with concise timezone/inclusive help below it.
- Theme selection moved from the header to Workspace settings → Appearance, available to all signed-in staff; saved browser colour preferences are retained.

The source manifest records the new catalog copies and the small application-binding extensions. Date-picker/calendar Today can be supplied by the clinic clock; Select and Combobox support external field labels/feedback without duplicating visible labels. The original motion and menu/calendar interactions remain in those components. The range trigger's host width and field-label alignment implement the user's explicit consistency request.

## Verification

- PASS: TypeScript compilation; production Vite build (existing large-bundle advisory remains).
- PASS: 169 tests. Added regression coverage for a nested searchable choice with a single label plus required/error descriptions, and Arc button native submit/disabled/link behavior. Existing date, bound navigation, field validation, permission and recovery suites pass.
- PASS: focused lint with no errors; pre-existing Fast Refresh/effect warnings remain in existing modules.
- PASS: desktop observation of aligned Appointment and Consultation controls; source Select keyboard status choice and existing filtered empty state; Activity fields on the same baseline. New reference demos for DatePicker, Select, SearchField and Button were inspected and relevant selection/clear/loading behavior exercised.
- Browser use was reduced after the user's feedback: remaining verification used source review and automated checks, with one final screenshot/geometry capture.
- Final DOM measurement: Person, Record, Action and Date range all have top=320px and height=44px at the captured desktop viewport. Evidence: `control-consistency-after.jpg`.
- Scope: local desktop preview. Exhaustive browser coverage of every inherited form or animation state is not claimed. No patient, consultation, integration, message or settings record was submitted during this check.

Run staff tests using `pnpm test`. The Node SSR test setup resolves CSS module names while Vite compiles the real CSS in the production build.
