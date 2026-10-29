import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setCurrentLanguage } from '../i18n/tr.ts';
import type { Advisory, Stretch, WalkAlert } from '../schema/advisory.ts';
import {
  isWalkReport,
  lookItems,
  orderedStretches,
  reportMarks,
  sourceLine,
  stopReasonNote,
  stretchTone,
} from './report.ts';

const stretch = (index: number, over: Partial<Stretch> = {}): Stretch => ({
  index,
  start_utc: `2026-10-03T04:3${index}:00Z`,
  end_utc: `2026-10-03T04:3${index}:20Z`,
  frames_used: 14,
  verdict: 'HEALTHY',
  top_class: null,
  frames_agreeing: 0,
  thermal_median_c: 28.9,
  lat: 26.8467,
  lon: 80.9462,
  pos_accuracy_m: 4,
  pos_source: 'phone_gps',
  ...over,
});

const alert = (id: number, over: Partial<WalkAlert> = {}): WalkAlert => ({
  alert_id: id,
  utc: '2026-10-03T04:34:10Z',
  class: 'wheat__brown_rust',
  frames_agreeing: 4,
  lat: 26.8468,
  lon: 80.9463,
  pos_accuracy_m: 5,
  ...over,
});

const advisory = (over: Record<string, unknown> = {}): Advisory =>
  ({ scan: { mode: 'walk' }, stretches: [], alerts: [], ...over }) as unknown as Advisory;

test('a walk advisory is told apart from an old single scan', () => {
  assert.equal(isWalkReport(advisory()), true);
  assert.equal(isWalkReport({ scan: { mode: 'handheld_pod' } } as unknown as Advisory), false);
  assert.equal(isWalkReport({ scan: { mode: 'handheld_pod' }, stretches: [] } as unknown as Advisory), true);
  assert.equal(
    isWalkReport({ scan: { mode: 'handheld_pod' }, summary: { stretches_total: 3 } } as unknown as Advisory),
    true,
  );
  assert.equal(isWalkReport(null), false);
});

test('stretch colours: green, red, amber, grey', () => {
  assert.equal(stretchTone('HEALTHY'), 'good');
  assert.equal(stretchTone('DISEASE'), 'bad');
  assert.equal(stretchTone('UNCERTAIN'), 'warn');
  assert.equal(stretchTone('NOT_CROP'), 'unknown');
  assert.equal(stretchTone('NO_DATA'), 'unknown');
  assert.equal(stretchTone('SOMETHING_NEW'), 'unknown');
});

test('stretches come back in walking order', () => {
  const a = advisory({ stretches: [stretch(2), stretch(0), stretch(1)] });
  assert.deepEqual(orderedStretches(a).map((s) => s.index), [0, 1, 2]);
});

test('stop reasons: interrupted and time limit are spelled out', () => {
  setCurrentLanguage('en');
  assert.equal(stopReasonNote('user')?.tone, 'unknown');
  assert.equal(stopReasonNote('user')?.detail, null);

  const cut = stopReasonNote('interrupted');
  assert.equal(cut?.label, 'Interrupted');
  assert.equal(cut?.tone, 'warn');
  assert.match(cut?.detail ?? '', /lost power/);
  assert.match(cut?.detail ?? '', /Nothing up to the cut was lost/);

  const limit = stopReasonNote('time_limit');
  assert.equal(limit?.label, 'Stopped at the time limit');
  assert.equal(limit?.tone, 'warn');

  assert.equal(stopReasonNote('error')?.tone, 'warn');
  assert.equal(stopReasonNote(null), null);
  assert.equal(stopReasonNote('brand_new_reason')?.label, 'brand new reason');
});

test('need a look: DISEASE stretches only, healthy and unclear are not listed', () => {
  const a = advisory({
    stretches: [
      stretch(0),
      stretch(1, { verdict: 'UNCERTAIN' }),
      stretch(2, { verdict: 'DISEASE', top_class: 'wheat__brown_rust', frames_agreeing: 5 }),
      stretch(3, { verdict: 'NOT_CROP' }),
    ],
  });
  const items = lookItems(a);
  assert.equal(items.length, 1);
  assert.equal(items[0].className, 'wheat__brown_rust');
  assert.equal(items[0].framesAgreeing, 5);
  assert.equal(items[0].alerted, false);
});

test('an alert inside a DISEASE stretch of the same disease is one row, not two', () => {
  const a = advisory({
    stretches: [stretch(4, { verdict: 'DISEASE', top_class: 'wheat__brown_rust', frames_agreeing: 3 })],
    alerts: [alert(1, { utc: '2026-10-03T04:34:10Z', frames_agreeing: 4 })],
  });
  const items = lookItems(a);
  assert.equal(items.length, 1);
  assert.equal(items[0].alerted, true);
  assert.equal(items[0].framesAgreeing, 4);
});

test('an alert outside every DISEASE stretch, or of another disease, stays its own row', () => {
  const a = advisory({
    stretches: [stretch(4, { verdict: 'DISEASE', top_class: 'wheat__brown_rust' })],
    alerts: [
      alert(1, { utc: '2026-10-03T04:50:00Z' }),
      alert(2, { utc: '2026-10-03T04:34:10Z', class: 'wheat__yellow_rust' }),
    ],
  });
  const items = lookItems(a);
  assert.equal(items.length, 3);
  // The stretch (04:34:00), the other-disease alert (04:34:10), the late alert (04:50:00).
  assert.deepEqual(items.map((i) => i.key), ['s4', 'a2', 'a1']);
  assert.deepEqual(items.map((i) => i.alerted), [false, true, true]);
});

test('need a look rows are in time order', () => {
  const a = advisory({
    stretches: [stretch(5, { verdict: 'DISEASE', top_class: 'wheat__brown_rust' })],
    alerts: [alert(1, { utc: '2026-10-03T04:31:00Z' })],
  });
  assert.deepEqual(lookItems(a).map((i) => i.key), ['a1', 's5']);
});

test('a walk with no problems has nothing to list', () => {
  assert.deepEqual(lookItems(advisory({ stretches: [stretch(0), stretch(1)] })), []);
  assert.deepEqual(lookItems({ scan: { mode: 'handheld_pod' } } as unknown as Advisory), []);
});

test('map marks: only located things, circle is the stated accuracy', () => {
  const a = advisory({
    stretches: [
      stretch(0),
      stretch(1, { lat: null, lon: null, pos_accuracy_m: null }),
      stretch(2, { verdict: 'DISEASE', top_class: 'wheat__brown_rust', pos_accuracy_m: 12.5 }),
      stretch(3, { pos_accuracy_m: null }),
    ],
    alerts: [alert(1), alert(2, { lat: null, lon: null })],
  });
  const marks = reportMarks(a);
  assert.deepEqual(marks.map((m) => m.key), ['s0', 's2', 's3', 'a1']);
  assert.equal(marks[0].radiusM, 4);
  assert.equal(marks[1].radiusM, 12.5);
  assert.equal(marks[1].tone, 'bad');
  // No stated accuracy: no circle, rather than an invented one.
  assert.equal(marks[2].radiusM, 0);
  assert.equal(marks[3].kind, 'alert');
  assert.equal(marks[3].radiusM, 5);
});

test('no positions at all means no marks', () => {
  const a = advisory({ stretches: [stretch(0, { lat: null, lon: null })], alerts: [] });
  assert.deepEqual(reportMarks(a), []);
});

test('the source line is one neutral sentence pair', () => {
  setCurrentLanguage('en');
  assert.equal(
    sourceLine(advisory({ time_source: 'phone', gps: { source: 'phone_gps' } })),
    'Time from phone. Positions from phone GPS.',
  );
  assert.equal(
    sourceLine(advisory({ time_source: 'gps', gps: { source: 'pod_gps' } })),
    'Time from GPS. Positions from pod GPS.',
  );
  // Falls back to the stretches when the scan-level block does not say.
  assert.equal(
    sourceLine(advisory({ time_source: 'phone', stretches: [stretch(0), stretch(1)] })),
    'Time from phone. Positions from phone GPS.',
  );
  assert.equal(sourceLine(advisory({ time_source: 'filesystem' })), 'Time from pod storage.');
  assert.equal(sourceLine(advisory()), null);
});

test('the source line carries no warning wording', () => {
  setCurrentLanguage('en');
  const line = sourceLine(advisory({ time_source: 'phone', gps: { source: 'phone_gps' } })) ?? '';
  assert.doesNotMatch(line, /warning|not set|wrong|unreliable|fallback|only/i);
});
