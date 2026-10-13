# Capture onboarding TODO — 11 October 2026

User decision: immediate onboarding. No invite/approval or verification gate for now. Collect account details and prefill the clinic information from the Capture quote flow. Latest scope adds a personalised completion and a first dashboard overview handoff. Remaining module empty states are next.

- TODO: configure a real identity provider and verification in HMS_NEW. The existing OIDC frontend/API support is not configured. This is explicitly deferred by the user.
- TODO: persist new-customer enquiries/account setup in PostgreSQL with a separate unverified onboarding record. Do not treat browser metadata or self-selected roles as clinical workspace permissions.
- TODO: notifications to mittapally.sachin@gmail.com and +918217286695 after a delivery transport is connected.
- TODO: internal ops inbox/dashboard for those records.
- TODO: provision a new empty customer workspace and build dashboard empty states after this login/setup phase. Never drop a new customer into another clinic’s seeded records.

Implementation is isolated on branch `codex/capture-onboarding-login`, worktree `/Users/deepakonda/.codex/worktrees/capture-onboarding-login/HMS_NEW`. Its detailed handoff is `HMS_NEW/docs/plan/CAPTURE_ACCOUNT_ONBOARDING.md`; staff preview is port 5189, served through Capture port 3003 at `/staff/onboarding`. The primary staff source and its normal login/permission checks were preserved.

The current flow follows the Sri Lakshmi mobile number → six-digit demo code (123456) → name/designation/avatar profile. Known clinic details carry over; only skipped clinic name/city are collected in setup step 2. No SMS is sent. TODO: connect server-issued phone OTP challenges, expiration, resend limits and abuse protection along with the identity provider. Completion remains an unverified sessionStorage draft, not a provider-authenticated account or durable database submission.

The welcome now carries profile/clinic/template into `/staff/workspace`, a presentation-only first overview using the existing HMS shell. The route never mounts clinical components or a staff API identity. Full dashboard onboarding/provisioning remains TODO.
