import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
const {
  KanbanBoard,
  SupportConversation,
  ConversationComposer,
  SettingsPage,
  QueueBoard,
  queueMove,
  queueColumns,
  WorkspaceContext,
} = await tsImport("./arc-next-fixtures.ts", {
  parentURL: import.meta.url,
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
});
const token = {
  tokenId: "token",
  tokenNo: 7,
  patientId: "patient",
  appointmentId: "appointment",
  priority: "normal",
  status: "waiting",
  doctorStaffId: "doctor",
  doctorName: "Dr Rao",
};
test("Queue board accepts only backend-supported transitions and cannot select call-next or revive patients", () => {
  const statuses = ["waiting", "called", "in_service", "done", "skipped"];
  const expected = new Map([
    ["waiting:skipped", "skip"],
    ["called:skipped", "skip"],
    ["called:in_service", "start"],
    ["in_service:done", "complete"],
  ]);
  for (const from of statuses)
    for (const to of statuses) {
      const move = queueMove({ ...token, status: from }, to, true, "doctor");
      assert.equal(
        move?.action ?? null,
        expected.get(`${from}:${to}`) ?? null,
        `${from} → ${to}`,
      );
    }
  assert.equal(queueMove(token, "skipped", false), null);
  assert.equal(queueMove(token, "skipped", true, "another-doctor"), null);
});
test("Queue board preserves unknown server statuses instead of dropping records", () => {
  const columns = queueColumns([
    token,
    { ...token, tokenId: "other", status: "other_status" },
  ]);
  assert.equal(
    new Set(columns.map((column: { id: string }) => column.id)).size,
    6,
  );
  assert.ok(
    columns.some((column: { id: string }) => column.id === "other_status"),
  );
});
test("Queue board permission/unknown locks retain context without exposing generic task editing", () => {
  const context = {
    me: {
      tenantId: "tenant",
      staffId: "staff",
      permissions: { "queue.manage": ["clinic"] },
    },
    facility: { facilityId: "clinic", timezone: "Asia/Kolkata" },
    practitioners: [],
    go: () => assert.fail("render cannot navigate"),
  };
  const html = render(
    h(
      WorkspaceContext.Provider,
      { value: context },
      h(QueueBoard, {
        tokens: [token],
        command: { busy: false, unknown: true },
        unavailable: false,
        patient: () => h("span", null, "Patient context"),
        date: "2026-10-19",
        onChanged: () => assert.fail("render cannot save"),
      }),
    ),
  );
  assert.ok(
    html.includes("Patient queue") &&
      html.includes("Patient context") &&
      html.includes("Token 7"),
  );
  assert.ok(
    html.includes('aria-roledescription="Card"') &&
      !html.includes('aria-roledescription="Draggable card"'),
  );
  assert.ok(
    !html.includes("BIL-142") &&
      !html.includes("Billing v2") &&
      !html.includes("New checklist"),
  );
  assert.match(
    html,
    /<button[^>]+aria-label="Add card to Waiting"[^>]+hidden=""[^>]+disabled=""/,
  );
});
test("empty Kanban never imports the reference sample records", () => {
  const html = render(
    h(KanbanBoard, {
      columns: [{ id: "waiting", name: "Waiting" }],
      people: [],
      cards: [],
      allowCreate: false,
      onMoveRequest: () => assert.fail("render cannot move"),
    }),
  );
  assert.ok(!html.includes("Proration") && !html.includes("BIL-"));
});
test("WhatsApp thread renders supplied history, metadata and state without sample replies, typing or fake attachments", () => {
  const html = render(
    h(SupportConversation, {
      title: "Riya",
      subtitle: "+919000000001 · Unassigned",
      resolved: false,
      messages: [
        {
          id: "in",
          sender: "Riya",
          outgoing: false,
          text: "Morning appointment?",
          time: "10:00 am",
          day: "19 Oct 2026",
        },
        {
          id: "out",
          sender: "Priya",
          outgoing: true,
          text: "Please choose a time.",
          time: "10:01 am",
          day: "19 Oct 2026",
          delivery: "Preview · queued",
        },
      ],
      composer: "Guarded composer",
    }),
  );
  assert.ok(
    html.includes("Morning appointment?") && html.includes("Preview · queued"),
  );
  assert.equal(html.match(/19 Oct 2026/g)?.length, 1);
  assert.ok(
    !html.includes("Ava") &&
      !html.includes("typing") &&
      !html.includes("Attach a PDF") &&
      !html.includes("Exporting charts"),
  );
});
test("WhatsApp composer retains length limits, multiline input and blocked-send state", () => {
  const html = render(
    h(ConversationComposer, {
      value: "Draft reply",
      onChange: () => {},
      onSend: () => assert.fail("render cannot queue"),
      suggestions: ["Thanks"],
      placeholder: "Reply",
      disabled: true,
    }),
  );
  assert.match(html, /<textarea[^>]+maxLength="4096"[^>]+disabled=""/i);
  assert.ok(
    (html.match(/<button[^>]*>/g) ?? []).every((button: string) =>
      button.includes('disabled=""'),
    ),
  );
  assert.ok(html.includes("Draft reply"));
});
test("Settings opts into a full dashboard layout while preserving its permitted navigation and form slot", () => {
  const html = render(
    h(
      SettingsPage,
      {
        fullPage: true,
        current: "account",
        sections: [
          {
            id: "account",
            label: "My account",
            description: "Current clinic",
            icon: null,
          },
        ],
        account: { name: "Priya", detail: "Admin" },
        onChange: () => assert.fail("render cannot navigate"),
      },
      "Actual settings form",
    ),
  );
  assert.ok(html.includes("root workspace"));
  assert.ok(
    html.includes("Actual settings form") &&
      html.includes('aria-current="page"'),
  );
});
