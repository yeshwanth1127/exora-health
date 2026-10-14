# WhatsApp template status lookup

13 October 2026. WhatsApp-only phase. Sarvam remains paused. This action reads Meta; it does not create, submit or send a template.

## Staff flow

WhatsApp → Templates keeps **Local draft** and **Meta status** separate. Staff with `comms.manage` for the selected clinic can select **Check Meta status** once that clinic has an explicit managed binding and server-held token. Missing credentials disable the action and explain the connection requirement.

Only a current exact match with provider status `APPROVED` displays “Meta approved · current draft matches.” Missing templates, different content, unsupported components, pending/rejected/paused or unknown statuses have distinct results. Later edits invalidate the observation's version; failed checks preserve the last observation without presenting it as a fresh check.

## Contract and persistence

`POST /v1/message-templates/:templateId/provider-status` requires `Idempotency-Key`, `{ facilityId, version }`, current clinic authority and an active communications module. Tenant and actor come from authenticated context. The response carries template ID, the new local version, provider status/ID, match and check time.

The command reserves its actor-bound receipt before the provider read. A retry with the original key/body/actor returns the original result without another Meta lookup, even if the draft later changes. Reusing the key with another actor or payload conflicts. The frontend freezes an uncertain request; malformed success responses remain uncertain and can only be recovered with that original request/key.

Provider reads hold no template/account lock. Before saving, the command locks and rechecks the clinic account, configured WABA/token reference, draft version, current active staff/user authority and module state. Supported grant revocations serialize with the final access check. A change during the read refuses the observation rather than applying it to a different draft or clinic.

Migration `20261013080000_whatsapp_template_provider_check.sql` adds immutable, tenant-isolated observations with actor, clinic/account, captured phone/WABA, template version, body hash, provider ID/status, content-match result and check time. Audit and outbox entries commit with the observation and receipt. Normal account edits cannot replace a number after callback or template-check history exists. Number migration needs a dedicated workflow.

## Provider read and matching limits

The client uses only `GET /{pinned Graph version}/{configured WABA}/message_templates` on `https://graph.facebook.com`, with the token in the authorization header. It rebuilds pagination on that same endpoint instead of following supplied URLs, refuses redirects, and bounds the read to ten pages, one MiB per response and a ten-second overall deadline. Provider failures are sanitized; there is no automatic retry. Ambiguous results or malformed pages fail instead of claiming absence.

An exact match requires the same name, language, category and body, with validated numbered positional parameters. The editor currently supports a body-only utility/marketing template. Headers, footers, buttons, named parameters and other structures are reported as unsupported. Unknown or paused provider statuses never become approval. A matching observation is evidence at its check time, not a guarantee of future send eligibility.

Primary contracts checked: [Meta template management](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management) and [template overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview). API format validation does not prove that the configured version or account is supported live.

## Verification and next boundary

- Full isolated backend suite: **33 files / 348 tests passing**, database `hms_whatsapp_template_status_test` on local port 54359. The status phase adds 10 pure provider-client tests and 7 persisted HTTP tests.
- **137 frontend tests passing**, including malformed response recovery with the same key/body; backend TypeScript and frontend TypeScript/production build pass.
- HTTP coverage checks tenant/clinic/actor isolation, missing credentials, receipt replay, stale drafts, unsupported/different content, provider failures, concurrent edits, changed account bindings and withdrawn authority.
- Desktop preview shows separate draft/status columns and truthfully disables the check without credentials. The preview retains existing synthetic records.

No actual Meta lookup, template submission, sending or production migration was verified. The subsequent [immutable submission phase](WHATSAPP_TEMPLATE_SUBMISSIONS.md) implements creation requests and uncertain-write reconciliation locally; status reads now target a captured revision name when present. Provider callbacks, fleet rate limits, outbound transport and controlled clinic acceptance remain. The old bulk `/message-templates/sync` action stays unavailable. Counts above retain this earlier status checkpoint.
