# Context previews, doctor setup and Settings — 19 October 2026

Continuation of `279c945` on `codex/admin-dashboard-arc`, in the existing isolated worktree. The user approved the next phase, requested useful extra hover context, and reserved WhatsApp-themed Arc chat and Kanban for the next turn. Desktop only; visual verification stays with the user.

## Changes and placements

| Before | After | Why |
| --- | --- | --- |
| Patient hover repeats MRN, phone and status already in the table | Appointments and Queue hover show recorded visit reason, DOB with estimated flag, language and age | Supply extra context without opening clinical charts or repeating table columns |
| Add doctor combines staff selection, affiliation and automatic calendar creation | Arc Pro Multi-step form presents Staff account → Clinic → Calendar → Fees | Make each independently saved operation visible and recoverable |
| Interrupted setup is scattered across details | Doctor details → Continue calendar & fees setup resumes from the saved profile | Avoid creating staff accounts or affiliations again |
| Settings sections are a row of buttons | Arc Pro Settings page navigation with gliding selected item, keyboard movement, section transitions and account identity | Give settings a clear, consistent section structure |
| Staff name/phone editor has an always-present Save button | Scoped Arc save bar appears when those fields change, with a count, Discard and Save changes | Give explicit draft feedback while keeping security and policy actions separate |

## Data and command bindings

### Hover previews

`src/hms/patient-preview.ts` maps only extra context. It does not repeat MRN, patient/booking caller phone, email, account status or appointment time. Age uses the clinic's current calendar day and carries “Approximately” for an estimated DOB. Missing fields are omitted, with an explicit empty-context message when none are present.

Appointments passes the existing recorded `reason`. Queue passes `appointmentId`; while the hover is open, a separately permission-gated appointment read supplies the reason only when the returned patient and clinic match. Queue reuses the patient detail it already fetched. Appointments still fetches patient detail only when the hover opens. Patient previews require `patients.read`; Queue's extra appointment read requires `appointments.read`. No general patient note exists on PatientDetail, so no note is fabricated or borrowed from clinical/consent endpoints. A failed extra appointment read has its own feedback.

### Doctor setup

`src/hms/Doctors.tsx` retains the existing staff-account/department prerequisite editors and their saved-ID/read recovery. Selecting an existing account does not create another one. The Clinic stage submits the original idempotent affiliation command. Its result or recovered original receipt advances to Calendar; it no longer automatically creates a calendar and closes the panel.

Calendar is separately created through the existing command and original-receipt recovery. Only a saved profile calendar ID or successful command/receipt allows progression to Fees. “Finish later” preserves saved records. Doctor details exposes “Continue calendar & fees setup”; reopening reads the profile and verifies a current/upcoming affiliation in this clinic before resuming. No PII draft or fake completion checklist is persisted in browser storage. Staff-account-only progress resumes by selecting that saved account in Add doctor.

Fees reuses DoctorFees, including actual service defaults, integer-paise/null semantics, permission checks, effective dates, command recovery and draft guards. “Finish review” closes through the leave guard; it does not claim fees were changed, hours published, registration verified, invitation delivered or bookability achieved. Working hours stay in Schedules. Busy/unknown commands block navigation; a fee draft must be saved or explicitly discarded before leaving. A failed/stale profile read cannot enable stage progression.

### Settings

`src/hms/Settings.tsx` supplies only existing permitted sections, guarded `go` navigation, actual account identity, and existing forms to Arc SettingsPage. Registrations is a shorter navigation label; its full professional-registration workflow is retained. Roles, grants, staff status, policy changes, modules and consent documents retain their individual commands, versions, confirmations and recovery.

The save bar is deliberately scoped to **Team → Manage staff → name and phone**. Count and Discard apply only to those two draft fields. The existing Action submits the existing versioned PATCH and toasts only after success. A small optional Action `size` prop gives Save and Discard matching compact sizing. Pending/unknown operations disable discard and writes. No cross-section Save all or simulated saved animation is introduced. Appearance remains an immediate browser preference; booking policy and access operations keep their review dialogs.

## Reference ports and fidelity boundary

New folders: `src/components/arc/multi-step-form/` and `settings-page/`.

- Multi-step form presentation is ported from local `components/pro/multi-step-form/src/dependencies/44818.cjs`, not the umbrella preview's sample project. Its directional step slides, progress markers, text/label swaps and measured height are retained. Application bindings control the active stage and disabled navigation. The root is a section so each stage can contain its independent real form; the footer submits the current form by ID. The demo's unconditional “All set / Your response has been saved” is not used for this staged workflow. Disabled Next mirrors the demo's disabled Back styling.
- Settings presentation is ported from `components/pro/settings-page/src/SettingsPage.cjs`. Source section/nav styles, directional pane motion, shared highlight, keyboard section movement and measured floating save-bar shell are retained. The application supplies sections/content and a scoped real save action. The demo's simulated save, billing, passwords, sessions and account data are not imported. Existing AnimatedCounter supplies the dirty-field count. Saved feedback comes from the existing confirmed-result toast; no timer can manufacture success.
- CSS is extracted from each corresponding `dist/styles.css`, preserving namespace rules, media/container/reduced-motion rules and keyframes, with hashed class names removed. Existing Arc tokens and shared form controls remain in use. No new dependency is needed. `component-source-manifest.json` records reference and integrated SHA-256 hashes plus these adaptations.

**Rendered parity and pointer/keyboard animation verification remain awaiting the user's review.** Source fidelity and a successful build are not a claim of pixel/motion parity.

## Verification and counts

- PASS: 207 frontend tests. Updated context/privacy test plus new tests cover estimated age/birthday boundaries, wizard form ownership and non-clickable progress, blocked stage navigation, permission-supplied Settings navigation and dirty-only/blocked-discard save bars. Existing recovery, validation, permission and backend-adapter tests remain green.
- PASS: TypeScript and production Vite build; inherited large-bundle advisory remains.
- PASS: focused lint on new ports and modified HMS/settings modules. Shared `workspace.tsx` still has its pre-existing Fast Refresh/export and set-state-in-effect warnings.
- PASS: source manifest digests, **39 adopted + 5 support = 44 component folders**, and whitespace checks.
- UNVERIFIED: interactive saved-stage recovery and endpoint writes, rendered geometry/motion, live/provider delivery and deployment. No browser automation, patient/staff/calendar/fee writes, provider messages or deployment were performed for verification.

This adds **two adopted components**, not two new unique catalog reviews: both were already screened. Earlier documentation records 82/83 candidate counts and Claude's all-116-Pro documentation survey; these overlap and must not be added together or reported as 116 rendered/behaviorally tested components.

## Exact continuation target

Dashboard `http://127.0.0.1:5198/staff/` → isolated API **3080**; branch `codex/admin-dashboard-arc`; worktree `/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW`. Reuse this checkout. Do not switch to the dirty primary checkout or old API3079. A full reload may require Open workspace for the seeded `priya` identity; auth remains memory-only. Read `next-whatsapp-kanban.md` for the explicitly requested next turn.
