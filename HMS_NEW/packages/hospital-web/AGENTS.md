# Shared hospital website components

Read README.md before adding a template. Reuse the exported runtime, sections, care pages and schedule/assistant flow. Add compositions and scoped styles rather than copying a website app. Hospital identity, roster and content come through useWebsite(), never hardcoded labels. Keep sample content explicitly labelled and separate from published clinical records.

Prefer existing Arc controls and adopted local Pro adapters. Inspect the corresponding rendered local reference before adopting or changing a component; preserve its appearance, states, keyboard behavior and motion. Do not embed a Pro demo with fixed business records in a live page. Existing Sri Lakshmi and Editorial applications remain separate; do not change them as a side effect of work in this package.

Run package tests, host build, onboarding/static-serving contracts and browser checks for affected layouts. Build success alone does not establish visual parity, provider delivery or deployment.
