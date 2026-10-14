import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { afterEach } from "node:test";
import { templateTransport } from "../src/hms/MessageTemplates.tsx";
import { OperationalIntent } from "../src/hms/operational-intent.ts";
import { HmsError } from "../src/hms/client.ts";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
const { TemplateMetaStatus, TemplateSubmissionStatus } = await tsImport(
  "../src/hms/MessageTemplates.tsx",
  {
    parentURL: import.meta.url,
    tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
  },
);
const observation = {
  status: "APPROVED",
  match: "exact" as const,
  checkedAt: "2026-10-13T04:30:00Z",
  providerTemplateId: "meta-template-id",
  localVersion: 7,
};
const render = (
  check:
    | typeof observation
    | {
        status: string | null;
        match: "exact" | "different" | "missing" | "unsupported";
        checkedAt: string;
        providerTemplateId: string | null;
        localVersion: number;
      }
    | undefined,
  version = 7,
) =>
  renderToStaticMarkup(
    React.createElement(TemplateMetaStatus, { check, version }),
  );
test("only a current exact Meta approval identifies the current draft as approved", () => {
  assert.match(render(observation), /Meta approved · current draft matches/);
  const stale = render(observation, 8);
  assert.match(stale, /Meta: APPROVED/);
  assert.match(stale, /Draft changed since last check/);
  assert.doesNotMatch(stale, /Meta approved · current draft matches/);
  const different = render({ ...observation, match: "different" });
  assert.match(different, /resubmission needed/);
  assert.doesNotMatch(different, /Meta approved · current draft matches/);
});
test("missing and unsupported provider formats do not become a local approval claim", () => {
  const missing = render({
    ...observation,
    status: null,
    match: "missing",
    providerTemplateId: null,
  });
  assert.match(missing, /Not found in Meta/);
  assert.doesNotMatch(missing, /approved/);
  const unsupported = render({ ...observation, match: "unsupported" });
  assert.match(unsupported, /Provider format needs review/);
  assert.doesNotMatch(unsupported, /current draft matches/);
  assert.match(render(undefined), /Not checked with Meta/);
});
test("matching pending or rejected content is clearly distinct from Meta approval", () => {
  for (const status of ["PENDING", "REJECTED", "PAUSED", null]) {
    const html = render({ ...observation, status });
    assert.match(html, /Current draft matches Meta/);
    assert.doesNotMatch(html, /Meta approved/);
    assert.match(html, /datetime="2026-10-13T04:30:00Z"/i);
  }
});

test("a malformed possibly committed Meta check freezes its original version and key until replay", async () => {
  const id = "00000000-0000-4000-8000-000000000002";
  const path = `/v1/message-templates/${id}/provider-status`;
  const result = {
    templateId: id,
    version: 8,
    providerStatus: "APPROVED",
    match: "exact",
    checkedAt: observation.checkedAt,
    providerTemplateId: "meta-template-id",
  };
  const malformed = [
    { ...result, version: "PRIVATE_RESPONSE" },
    { ...result, templateId: "00000000-0000-4000-8000-000000000003" },
    { ...result, version: 9 },
    { ...result, match: "missing" },
    { ...result, providerStatus: null },
    { ...result, providerTemplateId: null },
  ];
  for (const bad of malformed) {
    const sent: { body: unknown; key: string | null }[] = [];
    globalThis.fetch = async (_url, init) => {
      sent.push({
        body: JSON.parse(String(init?.body)),
        key: new Headers(init?.headers).get("Idempotency-Key"),
      });
      return Response.json(sent.length === 1 ? bad : result);
    };
    const command = new OperationalIntent(
      templateTransport,
      () => "original-workspace",
    );
    await assert.rejects(
      command.execute(
        path,
        {
          method: "POST",
          body: {
            facilityId: "00000000-0000-4000-8000-000000000001",
            version: 7,
          },
        },
        true,
      ),
      (error: HmsError) =>
        error.code === "outcome_unknown" &&
        !error.message.includes("PRIVATE_RESPONSE"),
    );
    assert.equal(command.unknown, true);
    assert.equal(command.intent?.keyed, true);
    await assert.rejects(
      command.execute(path, { body: { version: 8 } }, true),
      /Recover/,
    );
    assert.equal(sent.length, 1);
    await command.replay();
    assert.equal(command.unknown, false);
    assert.equal(command.intent, null);
    assert.deepEqual(sent[0], sent[1]);
    assert.ok(sent[0].key);
  }
});

const submittedRevision = {
  id: "00000000-0000-4000-8000-000000000004",
  templateId: "00000000-0000-4000-8000-000000000002",
  facilityId: "00000000-0000-4000-8000-000000000001",
  templateVersion: 7,
  providerName: "hms_immutable_revision_name",
  body: "Hello {{1}}",
  language: "en",
  category: "utility" as const,
  parameterCount: 1,
  samples: ["Alex Example"],
  state: "queued" as const,
  providerTemplateId: null,
  providerStatus: null,
  reason: null,
  createdAt: observation.checkedAt,
  updatedAt: observation.checkedAt,
  currentDraftMatches: true,
  version: 1,
};
test("queued, submitted and uncertain revisions are distinct from approval or patient delivery", () => {
  for (const [state, label] of [
    ["queued", "Submission queued"],
    ["submitted", "Submitted to Meta"],
    ["uncertain", "Submission outcome unconfirmed"],
  ]) {
    const html = renderToStaticMarkup(
      React.createElement(TemplateSubmissionStatus, {
        submission: { ...submittedRevision, state },
      }),
    );
    assert.match(html, new RegExp(label));
    assert.match(html, /Meta name: hms_immutable_revision_name/);
    assert.doesNotMatch(html, /Meta approved|delivered|sent to patient/i);
    if (state === "uncertain") assert.match(html, /Do not submit it again/);
  }
  const oldRevision = renderToStaticMarkup(
    React.createElement(TemplateSubmissionStatus, {
      submission: {
        ...submittedRevision,
        state: "submitted",
        providerStatus: "APPROVED",
        currentDraftMatches: false,
      },
    }),
  );
  assert.match(oldRevision, /Draft changed since this submission/);
  assert.doesNotMatch(oldRevision, /current draft matches|Meta approved/);
});
test("submission recovery freezes fictional examples and reviewed version after malformed receipt", async () => {
  const path = `/v1/message-templates/${submittedRevision.templateId}/submissions`;
  const result = {
    templateId: submittedRevision.templateId,
    version: 8,
    submission: submittedRevision,
  };
  const malformed = [
    { ...result, version: 9 },
    { ...result, submission: { ...submittedRevision, templateVersion: 8 } },
    {
      ...result,
      submission: {
        ...submittedRevision,
        facilityId: "00000000-0000-4000-8000-000000000005",
      },
    },
    {
      ...result,
      submission: { ...submittedRevision, samples: ["Unexpected example"] },
    },
    { ...result, submission: { ...submittedRevision, parameterCount: 2 } },
    { ...result, submission: { ...submittedRevision, providerName: "" } },
  ];
  for (const bad of malformed) {
    const sent: any[] = [];
    globalThis.fetch = async (_url, init) => {
      sent.push({
        body: JSON.parse(String(init?.body)),
        key: new Headers(init?.headers).get("Idempotency-Key"),
      });
      return Response.json(sent.length === 1 ? bad : result);
    };
    const command = new OperationalIntent(
      templateTransport,
      () => "clinic-original",
    );
    const body = {
      facilityId: submittedRevision.facilityId,
      version: 7,
      samples: ["Alex Example"],
      fictionalExamples: true,
    };
    await assert.rejects(
      command.execute(path, { method: "POST", body }, true),
      (error: HmsError) => error.code === "outcome_unknown",
    );
    body.samples[0] = "Changed draft example";
    assert.equal(command.unknown, true);
    await assert.rejects(
      command.execute(path, { method: "POST", body }, true),
      /Recover/,
    );
    await command.replay();
    assert.deepEqual(sent[0], sent[1]);
    assert.deepEqual(sent[1].body.samples, ["Alex Example"]);
    assert.equal(command.unknown, false);
  }
});
