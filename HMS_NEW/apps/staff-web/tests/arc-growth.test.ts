import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
import { metricChange } from "../src/hms/growth-metrics.ts";

const opts = {
  parentURL: import.meta.url,
  tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)),
};
const { GrowthMetric, GrowthBar, GrowthSplit, GrowthDateTime } = await tsImport(
  "./arc-growth-fixtures.ts",
  opts,
);

test("growth comparisons keep direction and never invent growth from an absent baseline", () => {
  assert.equal(metricChange(75, 100), "-25%");
  assert.equal(metricChange(125, 100), "+25%");
  assert.equal(metricChange(100, 100), "0%");
  assert.equal(metricChange(12, 0), "New");
  assert.equal(metricChange(0, 0), undefined);
  assert.equal(metricChange(null, 100), undefined);
  assert.equal(metricChange(12), undefined);
});

test("metric cards distinguish unavailable delivery from zero and retain fractional conversion", () => {
  const missing = render(
    h(GrowthMetric, {
      label: "Delivered",
      value: null,
      suffix: "%",
      context: "No settled messages",
    }),
  );
  assert.ok(missing.includes('aria-label="Not available"'));
  assert.ok(!missing.includes("0%"));
  const zero = render(
    h(GrowthMetric, {
      label: "Delivered",
      value: 0,
      suffix: "%",
      context: "Of settled messages",
    }),
  );
  assert.ok(zero.includes("0%"));
  assert.ok(!zero.includes('aria-label="Not available"'));
  const fractional = render(
    h(GrowthMetric, {
      label: "Visitors who booked",
      value: 12.5,
      suffix: "%",
      decimals: 1,
      context: "Selected range",
    }),
  );
  assert.ok(fractional.includes("12.5%"));
});

test("booking-stage bars retain ordered exact counts including zero without treating stages as shares", () => {
  const html = render(
    h(GrowthBar, {
      label: "People at each booking stage",
      period: "Last 7 days",
      category: "Stage",
      averageLabel: "Average per stage",
      data: [
        {
          key: "visit",
          label: "Visited website",
          axisLabel: "Visited",
          value: 1000,
        },
        {
          key: "start",
          label: "Opened booking",
          axisLabel: "Opened",
          value: 120,
        },
        { key: "book", label: "Booked", axisLabel: "Booked", value: 0 },
      ],
    }),
  );
  assert.ok(html.indexOf("Visited website") < html.indexOf("Opened booking"));
  assert.match(html, /<td[^>]*>Booked<\/td><td[^>]*>0<\/td>/);
  assert.ok(html.includes("View data table"));
});

test("empty category charts show an empty state and keep the original zero rows available", () => {
  const html = render(
    h(GrowthSplit, {
      label: "Visitor devices",
      segments: [
        { id: "mobile", label: "Mobile", value: 0 },
        { id: "desktop", label: "Desktop", value: 0 },
      ],
    }),
  );
  assert.ok(html.includes("No visitor devices available"));
  assert.match(html, /<td[^>]*>Mobile<\/td><td[^>]*>0<\/td>/);
  assert.ok(!html.includes("NaN"));
});

test("scheduled growth actions retain local calendar day and minute precision in Arc controls", () => {
  const html = render(
    h(GrowthDateTime, {
      label: "Send at",
      value: "2026-10-19T00:07",
      onValueChange: () => assert.fail("render must not edit the schedule"),
    }),
  );
  assert.ok(html.includes('value="2026-10-19"'));
  assert.ok(html.includes('value="00:07"'));
  assert.ok(html.includes("Send at: date"));
  assert.ok(html.includes("Send at: time"));
  assert.ok(!html.includes('type="datetime-local"'));
});
