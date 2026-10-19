import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tsImport } from 'tsx/esm/api';
import { fileURLToPath } from 'node:url';
import { OperationsKpiReportSchema, type OperationsKpiReport } from '@hms/contracts';
import { overviewKpis, decodeOverviewKpis, reportStart } from '../src/hms/overview-kpis.ts';
import { periodDelta } from '../src/components/arc/kpi-drilldown/period-data.ts';
const options = { parentURL: import.meta.url, tsconfig: fileURLToPath(new URL('../tsconfig.app.json', import.meta.url)) };
const { KpiDrilldown } = await tsImport('../src/components/arc/kpi-drilldown/kpi-drilldown.js', options);
const { OverviewReporting } = await tsImport('../src/hms/OverviewReporting.tsx', options);
const ids = ['bookings', 'visits', 'checkIns', 'completed', 'cancelled', 'noShows'] as const;
const expected = { facilityId: '00000000-0000-4000-8000-000000000001', end: '2026-10-19', timezone: 'Asia/Kolkata' };
const report: OperationsKpiReport = {
  ...expected, availableFrom: '2026-01-01', asOf: '2026-10-19T12:00:00.000Z',
  metrics: ids.map((id, index) => ({ id, label: `Metric ${index + 1}`, description: 'Actual recorded events by clinic date.', lowerIsBetter: id === 'cancelled' || id === 'noShows', series: Array(180).fill(2), periods: {
    '7': { current: 14, previous: 7, complete: true, breakdowns: { doctor: [], channel: [] } },
    '30': { current: 60, previous: 30, complete: true, breakdowns: { doctor: [], channel: [] } },
    '90': { current: 180, previous: 90, complete: true, breakdowns: { doctor: [], channel: [] } },
  } })),
};

test('KPI cards announce exact period sums rather than final-day snapshots, with real 7/30/90 controls', () => {
  const markup = renderToStaticMarkup(h(KpiDrilldown, { kpis: overviewKpis(report), dimensions: [{ value: 'doctor', label: 'Doctor' }], end: report.end }));
  assert.match(markup, /Metric 1, 60, \+100\.0% versus the previous 30 days/);
  assert.doesNotMatch(markup, /Metric 1, 2,/);
  assert.match(markup, /aria-label="Date range"/);
  for (const label of ['7 days', '30 days', '90 days', 'Compare']) assert.ok(markup.includes(label));
  assert.doesNotMatch(markup, /MRR|Enterprise|Trial|NaN|Infinity/);
});
test('controlled 90-day range consumes its matching totals', () => {
  const html = renderToStaticMarkup(h(KpiDrilldown, { kpis: overviewKpis(report), dimensions: [{ value: 'channel', label: 'Channel' }], end: report.end, range: '90' }));
  assert.match(html, /Metric 1, 180, \+100\.0% versus the previous 90 days/);
});
test('unavailable/zero comparison baselines have a distinct accessible explanation', () => {
  assert.equal(periodDelta({ kind: 'total' }, 2, 0).available, false);
  assert.match(periodDelta({ kind: 'total' }, 2, null).text, /incomplete/);
  assert.equal(periodDelta({ kind: 'total' }, 0, 0).text, '0.0%');
  assert.equal(periodDelta({ kind: 'total' }, 0, 4).text, '−100.0%');
  assert.equal(periodDelta({ kind: 'total', lowerIsBetter: true }, 2, 4).good, true);
  const data = structuredClone(report);
  data.metrics[0]!.periods['30'].previous = null;
  const html = renderToStaticMarkup(h(KpiDrilldown, { kpis: overviewKpis(data), dimensions: [], end: data.end }));
  assert.match(html, /Comparison unavailable: incomplete previous period/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});
test('unknown days remain gaps after binding; zero and missing values stay distinct', () => {
  const data = structuredClone(report);
  data.metrics[0]!.series[0] = null;
  data.metrics[0]!.series[1] = 0;
  const kpi = overviewKpis(data)[0]!;
  assert.equal(kpi.series[0], null);
  assert.equal(kpi.series[1], 0);
  assert.equal(kpi.periods['90'].current, 180);
});
test('report decoder refuses wrong clinic, date, timezone, malformed counts and duplicated metrics', () => {
  assert.deepEqual(decodeOverviewKpis(report, expected), report);
  for (const change of [{ facilityId: '00000000-0000-4000-8000-000000000002' }, { end: '2026-10-18' }, { timezone: 'UTC' }]) {
    assert.throws(() => decodeOverviewKpis({ ...report, ...change }, expected), /did not match/);
  }
  const malformed = structuredClone(report);
  malformed.metrics[0]!.series[0] = -1;
  assert.throws(() => decodeOverviewKpis(malformed, expected));
  const duplicate = structuredClone(report);
  duplicate.metrics[1]!.id = duplicate.metrics[0]!.id;
  assert.equal(OperationsKpiReportSchema.safeParse(duplicate).success, false);
});
test('partial-history and timestamp captions remain visible outside the expanding cards', () => {
  const html = renderToStaticMarkup(h(OverviewReporting, { report: { ...report, availableFrom: '2026-10-18' } }));
  assert.match(html, /Recorded history starts 2026-10-18/);
  assert.match(html, /earlier dates are gaps/);
  assert.match(html, /Previous-period comparison is unavailable/);
  assert.match(html, /Today is partial/);
  assert.match(html, /Asia\/Kolkata/);
});
test('calendar reporting boundaries use inclusive days across leap years', () => {
  assert.equal(reportStart('2024-03-01', 7), '2024-02-24');
  assert.equal(reportStart('2026-01-01', 7), '2025-12-26');
});
