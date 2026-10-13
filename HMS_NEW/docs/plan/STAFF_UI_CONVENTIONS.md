# Staff workspace UI conventions

Applies to the desktop staff frontend in `apps/staff-web`. Preserve the original monochrome layout and operational workflows. These conventions do not change backend contracts, permissions, or mobile behavior.

## Fields and feedback

Use `Field`/`Choice` from the relevant existing workspace primitives; both use `SharedField`. Keep existing validity predicates and save gating. An error message is feedback, never the authority to permit a command.

- `id` and `controlId` identify the control. A missing ID is generated; the visible label, hint, and shown error refer to that same control. Nested Choice inherits its Field rather than creating another label.
- `error` is local validation. It becomes visible after blur, `touched`, or `submitted`; fixing the value clears the feedback immediately. Use `required` for the visible required hint and native semantics.
- `serverError` is a server refusal and always appears immediately. Do not pass server failures through `error` and accidentally hide them. `validationMode="always"` is a compatibility option for intentionally immediate feedback.
- `Action validate` is opt-in. It reveals/focuses invalid fields in its form, dialog, or sheet. Full-page callers must supply submitted state or their own submission validation. Existing disabled save buttons and server guards remain in place.

## Query states

`LoadingState` and `Resource` give initial failure precedence over loading/empty content. Initial failures show the error and retry; they must not expose empty-state create actions.

Recoverable refresh failure with prior data is an explicitly marked stale view. Its content is placed in a disabled fieldset. Consumers must also disable write actions outside that wrapper and any non-native actionable controls. Retain prior data only for the same authorized identity, clinic, and query scope. Authorization failures (401/403), missing records (404), and invalid-response decoding failures hide prior content.

Render actionable empty states only after the relevant read succeeds. Zero rows, a missing response, and a failed read are distinct states.

## Workflow tabs

`hms/ui` Choice adds search for entity-labelled sources with eight or more options (including state/UT and timezone lists). Small status/action enums retain the standard Select. `searchable` explicitly overrides the automatic rule. Search filters only the already authorized option source, never creates or fetches entities. The selected label comes from the full source and stays visible when filtering excludes it. Optional `description` supplies distinguishing clinic/department context when the caller has it; do not invent that context. Search clears when closing the popup. Arrow Up/Down enters the options, Enter selects a focused option, and Escape dismisses; text editing stays in the labelled search field.

Use `TabsTrigger variant="workflow"` for the Appointments/Waitlist/Queue and Staff activity/System status workspace tabs. It uses compact text labels and preserves the selected foreground/background through hover, focus, and pressed states. Standard tabs keep their default variant. Preserve keyboard navigation, route destinations, and permission gates.

## Dates and times

Use `DayNavigator`, `DateRangeField`, and `TimeRangeField` from `components/date-controls`. Dates stay `YYYY-MM-DD`; time ranges stay `HH:mm`. Calendar arithmetic does not turn a plain day into a browser-local instant. Today requires an authoritative timezone. A calendar control alone makes no claim about doctor availability.

Queue uses the selected clinic timezone. Activity's API interprets its inclusive From/To days in the organisation's configured timezone; that timezone is not exposed by the current identity DTO. Show “Organisation date boundary” and omit Today rather than inventing clinic or computer timezone semantics. Keep the existing API date-only filters. Inverted ranges are invalid and cannot be exported.

Weekly “Final date” remains inclusive in the UI; the schedule adapter converts it to the API's exclusive end. “Ongoing” means no end date. Scheduling currently refuses non-Asia/Kolkata clinics; do not silently broaden this boundary.

## Leaving a task

Use `requestLeave(callback)` for desktop navigation, clinic changes, and form dismissal. Register unsaved data through `useUnsaved`; in-flight and unknown outcomes require its pending guard. Discard cannot abandon an unresolved command. Recover the original idempotent intent before allowing another mutation or leaving the task.


## Visual direction after user review (13 October 2026)

Preserve the native shadcn neutral theme and existing control scale. The user rejected the broad coloured workspace redesign, oversized controls, numbered panels and nested cards; these were removed. Use local colour only to distinguish the next booking/check-in action, semantic status badges, destructive controls and availability selection. Keep task sections plain with native borders/separators and moderate spacing; do not introduce decorative cards or global typography/palette overrides. Keep helper text short and secondary; retain required authorization, uncertainty and scheduling messages.

Appointment actions belong near the patient name. Notification-job diagnostics and messaging-contact editing do not belong in appointment details; the existing source column and WhatsApp-origin badge identify actual channel provenance. Clinical allergy/flag actions must not render after chart access is refused.
