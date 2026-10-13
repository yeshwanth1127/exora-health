# Staff mutation review and recovery map

Updated 2026-10-13. Scope: active `WorkspaceSettings`, `BookingPolicy`, `WaitlistDesk`, `AdminPanels`, weekly-hours, `ScheduleRangeActions` and `AppointmentActions` commands. This is a frontend implementation inventory checked against current `/v1` routes and domain code. It does not claim persisted timeout/browser acceptance or provider delivery.

## Common behavior

`operational-intent.ts` retains a structured clone of one request in memory. `operational-command.ts` supplies the compatible React adapter, suppresses double submissions and registers the pending/unknown hard navigation blocker; `OperationalRecovery.tsx` renders its explicit recovery controls. Unknown outcomes freeze edits and dialog dismissal. Recovery cannot change the body, key, identity revision, tenant or original resource scope. It runs only after the user explicitly chooses recovery/check. Request snapshots, names, phones, reasons and consent text are never persisted to browser storage.

Keyed recovery sends the original body and Idempotency-Key. A permission refusal on retry does not erase prior uncertainty. Non-keyed commands are never automatically replayed. Where a read-back verifier exists, the UI clears uncertainty only after it observes the intended field/status (and a newer version when available). A matching state demonstrates the present outcome, not that this particular request or actor caused it. Failed, forbidden, malformed, inconclusive or missing reads keep the command unresolved. A normal refresh alone never clears uncertainty.

All server authorization, module-state, version and domain checks remain in force. The frontend sections do not grant access. `settings?section=` supports `team`, `roles`, `booking`, `modules`, `registrations`, `consent-documents`, `account`; invalid or unauthorized sections fall back to the first permitted section and disclose that fallback.

## Workspace settings

| Action | Actual method and route | Key support / recovery | Read-back proof and concurrency boundary |
| --- | --- | --- | --- |
| Create staff account and pending invitation | POST `/v1/staff-accounts` | Keyed; replay original request | Server creates staff/account/grant as one command. UI reports pending invitation, without claiming email delivery. Does not repeat a successful first step as a new command. |
| Edit staff name/phone | PATCH `/v1/staff/:id` | Not keyed; check saved state | Same person, `version > submitted version`, exact display name and normalized nullable phone. PATCH carries submitted version; stale version remains a refusal. |
| Grant role | POST `/v1/staff/:id/grants` | Keyed; replay original request | Review names recipient, role and named clinic/every-clinic scope. Server retains its grant and last-administrator safeguards. |
| Revoke role grant | POST `/v1/role-grants/:id/revoke` | Not keyed; check saved state | Active grant ID absent from current permitted staff list. This is observable current revocation/expiry, not request attribution; list changes can make proof inconclusive. |
| Reactivate/deactivate staff | POST `/v1/staff/:id/status` | Not keyed; check saved state | Matching active/disabled adapter status for same staff ID. No expected-version parameter on this status command; server access locks and administrator invariants still apply. |
| Copy role | POST `/v1/roles` | Keyed; replay original request | Original source role and new name remain frozen. Built-in role is never edited in place. |
| Change one permission | PUT `/v1/roles/:id/permissions/:permission` | Not keyed; check saved state | Target active role contains/does not contain the exact permission as requested. Reviewed organisation-wide impact; individual save only, no fictional atomic batch. Server serializes access invariants but exposes no role version/compare-and-set contract. |
| Retire role | POST `/v1/roles/:id/retire` | Not keyed; check saved state | Exact role absent from active role list. Server refuses built-in roles and roles still held. Absence proves current inactive state only. |
| Allow/disable overlapping appointments | PUT `/v1/facilities/:id/overbooking` | Not keyed; check saved state | GET same facility policy matches proposed enabled value. Review names clinic and explains retained existing bookings. Endpoint exposes boolean only, no overlap limit or expected version. Concurrent administrators can overwrite one another’s intent. |

Staff type and permission role have separate helper text. Access grants, removal, status changes, role permission changes and booking policy are staged before the write. During an uncertain operation, all additional writes are blocked and original input remains frozen.

## Waitlist

The adapter still uses explicit booking-party identity, specific doctor, a maximum 60-day preferred date span and actual availability. Anytime means any available time with that doctor through the displayed end date; it is not indefinite or any-doctor eligibility. Name/phone client errors wait for field interaction; save constraints remain enforced.

| Action | Actual method and route | Key support / recovery | Evidence and boundary |
| --- | --- | --- | --- |
| Add request | POST `/v1/waitlist` | Keyed; replay original request | Original normalized contact, doctor, dates and notes remain frozen. No fresh key on retry. |
| Prepare 15-minute offer | POST `/v1/waitlist/:id/offer` | Keyed; replay original request | Original request ID and selected start time; no new slot selection during uncertainty. Actual start/end shown, future in-range date and freshly loaded selected slot required. |
| Accept offer | POST `/v1/waitlist-offers/:id/accept` | Keyed; replay original request | Original offer ID and key survive timeout. Replay may recover an already committed acceptance after expiry; no newly chosen offer or second appointment intent is created. |
| Decline offer | POST `/v1/waitlist-offers/:id/decline` | **Not keyed; unknown stays blocked** | No exposed closed-offer outcome lookup. A waiting request without an offer can mean expiry or decline and cannot distinguish them. No retry/reconcile action is fabricated. UI instructs an administrator to check the original record. |
| Withdraw request | POST `/v1/waitlist/:id/withdraw` | Not keyed; check saved state | Same request ID appears with withdrawn status in the withdrawn list. This confirms current withdrawal, not actor/request attribution. List caps or permission refusal may leave uncertainty unresolved. |

Displayed expiry is absolute with remaining minutes. After expiry, ordinary Accept/Decline are disabled and Find another time refreshes current state. Recovery of an earlier unknown keyed acceptance remains a distinct action. Offer creation and acceptance do not claim message delivery.

## Administrative panels

| Action | Actual method and route | Key support / recovery | Verifier/version proof |
| --- | --- | --- | --- |
| Change module state | PUT `/v1/modules/:module` | Not keyed; check saved state | Exact module has requested state and version greater than submitted version. Domain command checks input version. Review records reason and distinguishes internal module availability from provider activation. |
| Renew staff invite | POST `/v1/staff/:id/invite/renew` | Not keyed; check saved state | Same staff account has a future invitation expiry. No request ID outcome lookup; does not prove email delivery. |
| Add professional registration | POST `/v1/staff/:id/registrations` | Keyed; replay original request | Original staff/council/number/expiry preserved; server uniqueness and actor checks remain. |
| Verify registration | PATCH `/v1/staff-registrations/:id` | Not keyed; check saved state | Exact registration version greater than input version and verified timestamp present. API still rejects self-verification. |
| Renew registration expiry | PATCH `/v1/staff-registrations/:id` | Not keyed; check saved state | Exact registration, newer version and exact nullable expiry. Bounded date dialog; explicit No expiry is supported by nullable API. Server renewal clears old verification; confirmation does not imply re-verification. |
| Create consent document draft | POST `/v1/consent-documents` | Keyed; replay original request | Frozen version/language/title/body, no repeated new draft. |
| Edit consent draft | PATCH `/v1/consent-documents/:id` | Not keyed; check saved state | Exact document, newer version, matching title/body. API enforces draft/version rules. |
| Publish consent version | POST `/v1/consent-documents/:id/publish` | Not keyed; check saved state | Exact document has published timestamp. Review names version/language and frozen-published-text consequence. Does not create patient consent. |
| Retire consent version | POST `/v1/consent-documents/:id/retire` | Not keyed; check saved state | Exact document has retired timestamp. Review gives reason and describes loss of current video consent until a replacement is published. |
| Review emergency access | POST `/v1/break-glass/:id/review` | Not keyed; check saved state | Same grant appears in reviewed/all list with reviewed timestamp, chosen outcome and displayed reviewer name matching current staff display name. Names are not unique actor IDs; this proves matching visible state, not definitive actor attribution. API keeps self-review refusal. A list cap may leave the target unprovable. |

All browser reason/date prompts in these panels are replaced by bounded shadcn dialogs with subject, scope, effect, validation, pending state and retained refusal. Consent publishing is reviewed separately from creating/editing a draft. Other in-app exits use the shared async discard protocol; pending/unknown writes cannot be discarded.

## Weekly hours, schedule ranges and appointment actions

Source evidence: `modules/weekly-hours.tsx` uses `useLegacyCommand` for saving; `modules/schedule-range-actions.tsx` uses it independently for BlockRange, OpenRange and BookRange; `modules/appointment-actions.tsx` uses it for moving/cancelling. The actual transport mapping is `hms/schedule-source.ts`; `operational-intent.ts` explicitly classifies the retained adapter paths. These are active schedule controls, unlike the dormant `ScheduleBlocks` / `RescheduleVisit` prototypes below.

| Active action | Actual method and route | Key support / unknown recovery | Domain and partial-work boundary |
| --- | --- | --- | --- |
| Review weekly plan | POST `/v1/practitioners/:id/weekly-plan/preview` | Read-only preview; never replayed as a save | Pending preview freezes navigation; signature binds review to the current unsaved fields. A preview is not save acceptance. |
| Save weekly hours | PUT `/v1/practitioners/:id/weekly-plan` | Keyed; replay original submitted plan | Exact doctor, scope, mode, effective range and sessions remain frozen. Backend rechecks conflicting appointments and schedule validity. Preview hydrates affected appointments; a confirmed save returns the PUT response without follow-up conflict reads, so read failure cannot turn confirmed success into command failure. |
| Preview blocked time | POST `/v1/practitioners/:id/exceptions/preview` | Read-only preview | Existing appointment review must complete before block save. Preview does not cancel or move a visit. |
| Block selected time | POST `/v1/practitioners/:id/exceptions` | Keyed; replay original block request | Same doctor, clinic, date/time and reason, without repeating moved visits or creating a different block. Save rechecks availability. |
| Open selected extra hours | POST `/v1/practitioners/:id/exceptions` | Keyed; replay original extra-hours request | Same clinic/mode/date/start/end/slot duration; local key forwarded in the header. Calendar and service eligibility remain server decisions. |
| Book a normal slot/exact range | POST `/v1/holds` or `/v1/holds/range`, followed by POST `/v1/appointments` | Keyed composite intent; original hold key uses `:hold` or `:range` suffix; booking uses original parent key | Recovery may revisit the original hold command to get its reservation and then the original booking command. It does not generate a new logical hold/booking key. A successful hold followed by known booking refusal can leave a temporary hold until its existing expiry; no explicit partial-hold release/reconciliation was added here. |
| Add overlapping appointment | POST `/v1/appointments/overbook` | Keyed; replay original request after adapter preflight | Frozen whole published slot and reason. Clinic policy plus permission required; no synthetic shortening of a requested range. Preflight can become stale or unavailable after the first attempt and can prevent reaching server replay; unresolved state remains frozen. |
| Move appointment time | GET `/v1/appointments/:id`, POST `/v1/holds` or `/v1/holds/range`, then POST `/v1/appointments/:id/reschedule` | Keyed composite intent; original hold suffix and original reschedule key | Current appointment read supplies doctor/mode. Old visit stays until the backend commits its replacement. Replaying the final command is safe by key; prior GET/availability/hold failures can prevent the adapter reaching that command. A resulting refusal after prior uncertainty must retain unknown state. |
| Cancel appointment | Adapter DELETE maps to POST `/v1/appointments/:id/cancel` | **Not keyed; unknown stays blocked** | Reason is frozen. No read-back verifier is wired into `AppointmentActions`; UI exposes administrative-check guidance and does not repeat cancellation. Adding an exact appointment status/reason verifier is a separate bounded improvement. |
| Unblock schedule exception | Adapter DELETE maps to POST `/v1/schedule-exceptions/:id/revoke` | **Not keyed; unknown stays blocked** | Active `ScheduleTimeline` now uses `useLegacyCommand`, freezes reason/action controls and blocks closing/navigating while pending or unknown. No verifier is fabricated from potentially truncated/recomputed timeline intervals; the recovery notice requires administrative outcome review rather than repeating revoke. |

Weekly-plan and range previews are separate read operations and do not share a fictitious atomic multi-operation save. Other sheet actions/clinic changes use the shared leave controller; pending/unknown child commands lock the parent action switch so the command cannot be unmounted to start another task.

## Remaining backend contracts and verification

1. **Policy and role-permission compare-and-set:** expose a persisted version/expected version or equivalent conditional write. Current frontend serializes one workspace intent and performs review; it cannot prevent two administrators from overwriting opposite requests. Existing server transaction/access locks protect invariants, not review-time freshness.
2. **Non-keyed outcome lookup:** a request-key/command-outcome route or specifically addressable state would improve decline, status, revocation, retirement, publication and invite renewal recovery. Do not add repeat mutations as lookup. Decline especially needs an addressable offer outcome distinguishing declined from expired/accepted.
3. **Actor/version proof:** break-glass response exposes reviewer name rather than reviewer ID; invite renewal lacks submitted version; grant/status checks use projections. State read-back is conservative and can remain blocked. Add stable actor IDs/versions where definitive reconciliation is required.
4. **Complete target read-back:** waitlist list caps and emergency-access read caps can prevent recovery lookup. Exact-ID reads or paginated complete scans are preferable; absence from capped reads is not universal absence.
5. **Read permissions after write:** a role with mutation authority but missing relevant read permission cannot reconcile an unknown write; the UI stays blocked. Do not weaken authorization to make recovery appear successful.
6. **Composite schedule recovery:** retain the original hold/reschedule/book key even when intermediary preflight/read-back changes. Provide explicit partial-result presentation for successful hold followed by booking refusal. Confirmed weekly saves no longer perform an affected-record read. Unblock and cancellation now have guarded non-keyed outcomes and remain intentionally blocked pending an addressable verifier.
7. **Environment verification:** pure recovery tests cover frozen snapshot/key, double submission, workspace-change refusal, failed lookup, prior uncertainty surviving a revoked-permission replay, keyed-route classification and section fallback. Typecheck/full frontend suite passed locally. Persisted timeout-after-commit, multi-admin races and browser keyboard/overlay acceptance must still be recorded separately in an authorized isolated environment. No backend mutations were exercised as part of this frontend implementation.

## Dormant/out-of-scope legacy code

`ScheduleBlocks` and `RescheduleVisit` remain defined in `modules/BookingOperations.tsx` but have no current source import/call site. Their legacy direct `api` writes and reschedule fresh-key behavior were not promoted to active HMS flows or claimed repaired here. `StaffPermissions` and older settings prototype sections likewise remain separate from mounted `WorkspaceSettings`. W08 is not an assertion that every mutation in the repository has been migrated.


Weekly save integration follow-up: only the read-only preview hydrates affected appointment records. A confirmed PUT response is returned without a subsequent appointment GET, so a denied read cannot reclassify that confirmed save as failure. Adapter regressions cover confirmed save without follow-up reads and preview refusal when conflict details are unavailable.
