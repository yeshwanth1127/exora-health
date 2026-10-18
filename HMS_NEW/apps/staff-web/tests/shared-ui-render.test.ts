import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
const config = fileURLToPath(new URL("../tsconfig.app.json", import.meta.url));
const { SharedField } = await tsImport("../src/components/shared-field.tsx", {
  parentURL: import.meta.url,
  tsconfig: config,
});
const { LoadingState, Choice, Field } = await tsImport("../src/hms/ui.tsx", {
  parentURL: import.meta.url,
  tsconfig: config,
});
const { DayNavigator, DateRangeField } = await tsImport(
  "../src/components/date-controls.tsx",
  {
    parentURL: import.meta.url,
    tsconfig: config,
  },
);
const { Tabs, TabsList, TabsTrigger } = await tsImport(
  "../src/components/ui/tabs.tsx",
  { parentURL: import.meta.url, tsconfig: config },
);

test("generated field IDs associate visible labels and hints without pristine error styling", () => {
  const html = renderToStaticMarkup(
    h(
      SharedField,
      { label: "Name", hint: "As recorded", required: true },
      h("input", { value: "", onChange: () => {} }),
    ),
  );
  const id = html.match(/<input[^>]+id="([^"]+)"/)?.[1];
  assert.ok(id);
  assert.ok(html.includes(`for="${id}"`));
  assert.ok(html.includes(`aria-describedby="${id}-description"`));
  assert.ok(!html.includes('data-field-error="true"'));
  assert.ok(!html.includes('role="alert"'));
  assert.ok(!html.includes('aria-invalid="true"'));
});
test("server refusal is visible and associated immediately; corrected local feedback clears", () => {
  const failed = renderToStaticMarkup(
    h(
      SharedField,
      {
        label: "Name",
        id: "name",
        hint: "As recorded",
        serverError: "Server refused",
      },
      h("input", { id: "name", value: "Jane", onChange: () => {} }),
    ),
  );
  assert.ok(failed.includes('aria-describedby="name-description name-error"'));
  assert.ok(failed.includes('aria-invalid="true"'));
  assert.ok(failed.includes("Server refused"));
  const corrected = renderToStaticMarkup(
    h(
      SharedField,
      { label: "Name", id: "name", touched: true, required: true },
      h("input", { id: "name", value: "Jane", onChange: () => {} }),
    ),
  );
  assert.ok(!corrected.includes('role="alert"'));
});
test("Choice trigger uses supplied control ID and hint association", () => {
  const html = renderToStaticMarkup(
    h(Choice, {
      label: "Doctor",
      id: "doctor",
      hint: "Choose a doctor",
      value: "a",
      onChange: () => {},
      options: [{ value: "a", label: "Doctor A" }],
    }),
  );
  assert.ok(html.includes('for="doctor"'));
  assert.ok(html.includes('id="doctor"'));
  assert.ok(html.includes('aria-describedby="doctor-description"'));
});
test("nested Choice inherits its Field association without duplicating the visible label", () => {
  const html = renderToStaticMarkup(
    h(
      Field,
      { title: "Doctor", id: "nested-doctor", hint: "Choose a doctor" },
      h(Choice, {
        label: "Doctor",
        value: "a",
        onChange: () => {},
        options: [{ value: "a", label: "Doctor A" }],
      }),
    ),
  );
  assert.equal((html.match(/<label/g) ?? []).length, 1);
  assert.ok(html.includes('for="nested-doctor"'));
  assert.ok(html.includes('id="nested-doctor"'));
  assert.ok(html.includes('aria-describedby="nested-doctor-description"'));
});
test("date controls expose bound navigation and do not invent Today when organisation timezone is unknown", () => {
  const html = renderToStaticMarkup(
    h(DayNavigator, {
      value: "2026-10-13",
      onChange: () => {},
      min: "2026-10-13",
      max: "2026-10-13",
      boundaryLabel: "Organisation date boundary",
    }),
  );
  assert.ok(html.includes('aria-label="Previous day"'));
  assert.ok(html.includes('aria-label="Next day"'));
  assert.equal((html.match(/<button[^>]*\sdisabled=""/g) ?? []).length, 2);
  assert.ok(!html.includes(">Today<"));
  const range = renderToStaticMarkup(
    h(DateRangeField, {
      from: "2026-10-13",
      to: "2026-10-15",
      onChange: () => {},
      timezone: "Asia/Kolkata",
    }),
  );
  assert.ok(range.includes('value="2026-10-13"'));
  assert.ok(range.includes('value="2026-10-15"'));
  assert.ok(range.includes("Both selected dates are included"));
  assert.ok(range.includes("aria-describedby="));
});
test("initial failure hides empty-state action while stale data is explicitly read-only", () => {
  const children = h("button", {}, "Create record");
  const initial = renderToStaticMarkup(
    h(
      LoadingState,
      {
        loading: false,
        error: "Network unavailable",
        data: null,
        refresh: () => {},
      },
      children,
    ),
  );
  assert.ok(!initial.includes("Create record"));
  assert.ok(initial.includes("Try again"));
  const stale = renderToStaticMarkup(
    h(
      LoadingState,
      {
        loading: false,
        error: "Network unavailable",
        data: { items: [1] },
        refresh: () => {},
      },
      children,
    ),
  );
  assert.ok(stale.includes('<fieldset disabled=""'));
  assert.ok(stale.includes("Showing previously loaded data"));
  const forbidden = renderToStaticMarkup(
    h(
      LoadingState,
      {
        loading: false,
        error: "Access revoked",
        data: { items: [1] },
        failure: { status: 403 },
        refresh: () => {},
      },
      children,
    ),
  );
  assert.ok(!forbidden.includes("Create record"));
});
test("workflow tab variant retains selected foreground on hover/focus; standard tabs remain unchanged", () => {
  const workflow = renderToStaticMarkup(
    h(
      Tabs,
      { value: "a" },
      h(
        TabsList,
        {},
        h(TabsTrigger, { value: "a", variant: "workflow" }, "Appointments"),
      ),
    ),
  );
  assert.ok(workflow.includes("data-active:hover:text-primary-foreground"));
  assert.ok(
    workflow.includes("data-active:focus-visible:text-primary-foreground"),
  );
  assert.ok(workflow.includes("min-h-10"));
  const standard = renderToStaticMarkup(
    h(
      Tabs,
      { value: "a" },
      h(TabsList, {}, h(TabsTrigger, { value: "a" }, "Appointments")),
    ),
  );
  assert.ok(!standard.includes("data-active:hover:text-primary-foreground"));
});

test("searchable choices reuse their outer label and retain required/error associations", () => {
  const html = renderToStaticMarkup(h(Field, {
    label: "Doctor", id: "arc-nested-doctor", hint: "Treating clinician", required: true,
    serverError: "Choose an available doctor",
  }, h(Choice, {
    label: "Doctor", value: "doctor-2", onChange: () => {},
    options: Array.from({ length: 10 }, (_, index) => ({ value: `doctor-${index}`, label: `Dr ${index}` })),
  })));
  assert.equal((html.match(/<label/g) ?? []).length, 1);
  assert.ok(html.includes('role="combobox"'));
  assert.ok(html.includes('value="Dr 2"'));
  assert.ok(html.includes('aria-required="true"'));
  assert.ok(html.includes('aria-invalid="true"'));
  assert.ok(html.includes('aria-describedby="arc-nested-doctor-description arc-nested-doctor-error"'));
});

test("Arc button adapter retains native submit, disabled and link behavior", async () => {
  const { Button } = await tsImport("../src/components/ui/button.tsx", { parentURL: import.meta.url, tsconfig: config });
  const disabled = renderToStaticMarkup(h(Button, { type: "submit", disabled: true }, "Save"));
  assert.ok(disabled.includes('type="submit"'));
  assert.ok(disabled.includes('disabled=""'));
  const link = renderToStaticMarkup(h(Button, { render: h("a", { href: "/staff/appointments" }), nativeButton: false }, "Appointments"));
  assert.ok(link.startsWith('<a '));
  assert.ok(link.includes('href="/staff/appointments"'));
});
