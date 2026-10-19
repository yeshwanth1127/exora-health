import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tsImport } from 'tsx/esm/api';
import { fileURLToPath } from 'node:url';
import { OperationsKpiReportSchema, type OperationsKpiReport } from '@hms/contracts';
import { overviewKpis, decodeOverviewKpis, reportStart, reportDateLabel } from '../src/hms/overview-kpis.ts';
import { periodDelta, countFrame } from '../src/components/arc/kpi-drilldown/period-data.ts';
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
test('compact report keeps history context visible and detailed help keyboard accessible', () => {
  const html = renderToStaticMarkup(h(OverviewReporting, { report: { ...report, availableFrom: '2026-10-18' } }));
  assert.match(html, /History since 18 Oct 2026/);
  assert.match(html, /this period is incomplete/);
  assert.match(html, /previous period unavailable/);
  assert.match(html, /Today is partial/);
  assert.match(html, /Asia\/Kolkata/);
  assert.match(html, /Metric 1, 14,.*previous 7 days/);
  assert.match(html, /About this activity report/);
  assert.match(html, /class="root embedded/);
});
test('calendar reporting boundaries use inclusive days across leap years', () => {
  assert.equal(reportDateLabel('2024-02-29'), '29 Feb 2024');
  assert.equal(reportStart('2024-03-01', 7), '2024-02-24');
  assert.equal(reportStart('2026-01-01', 7), '2025-12-26');
});

test('daily count charts preserve isolated peaks, unknown days and useful zero-period axes', () => {
  const days = Array<number | null>(90).fill(0);
  days[0] = null;
  days[88] = 2;
  const frame = countFrame(days, Array(90).fill(null), true);
  assert.equal(frame.a.length, 90);
  assert.equal(frame.a[88], 2);
  assert.equal(frame.a[0], null);
  assert.equal(frame.max - frame.pad, 2);
  assert.equal((frame.max + frame.min) / 2, 1);
  const zero = countFrame([0, 0], [null, null], true);
  assert.equal(zero.max - zero.pad, 1);
  assert.equal((zero.max + zero.min) / 2, .5);
});
