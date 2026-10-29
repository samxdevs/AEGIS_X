import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setCurrentLanguage } from '../i18n/tr.ts';
import {
  POD_SILENT_AFTER_MS,
  TRACK_BATCH,
  TrackQueue,
  appWarnings,
  displayElapsed,
  formatTimer,
  freshAlerts,
  highestAlertId,
  podWarningText,
  toPodUtc,
  toTrackFix,
} from './logic.ts';
import type { ScanAlert, TrackFix } from './logic.ts';

const alert = (id: number): ScanAlert => ({
  alert_id: id,
  utc: '2026-10-03T04:34:40Z',
  class: 'wheat__brown_rust',
  frames_agreeing: 4,
  lat: null,
  lon: null,
  pos_accuracy_m: null,
});

const fix = (n: number): TrackFix => ({
  utc: '2026-10-03T04:34:38Z',
  lat: 26.8467 + n / 1e5,
  lon: 80.9462,
  accuracy_m: 4,
  speed_mps: 0.6,
});

// ---- Warning wording ------------------------------------------------------

test('every pod warning code has the exact spec sentence', () => {
  setCurrentLanguage('en');
  assert.equal(
    podWarningText('TOO_DARK'),
    'Too dark to see the leaves. Scan in daylight or move out of the shade.',
  );
  assert.equal(podWarningText('TOO_BRIGHT'), 'Too much glare. Tilt the pod away from the sun.');
  assert.equal(podWarningText('BLURRY_SLOW_DOWN'), 'Walk slower. Pictures are coming out blurry.');
  assert.equal(
    podWarningText('NOT_SEEING_CROP'),
    'Not able to see the leaves clearly. Point it towards the crop.',
  );
  assert.equal(
    podWarningText('FIELD_STATION_NOT_FOUND'),
    'Field station not found. Check that it is switched on. The scan continues without weather and soil data.',
  );
  assert.equal(podWarningText('POD_HOT'), 'Pod is getting hot. Keep it out of direct sun.');
  assert.equal(podWarningText('STORAGE_LOW'), 'Pod storage almost full.');
  assert.equal(
    podWarningText('STORAGE_CARD_MISSING'),
    "Storage card not found. Saving to the pod's internal memory.",
  );
});

test('a pod warning code the app does not know is shown, not hidden', () => {
  setCurrentLanguage('en');
  assert.equal(podWarningText('LOW_VOLTAGE'), 'Pod notice: low voltage');
});

test('warnings come out in Hindi when the app is in Hindi', () => {
  setCurrentLanguage('hi');
  assert.notEqual(podWarningText('TOO_DARK'), 'Too dark to see the leaves. Scan in daylight or move out of the shade.');
  setCurrentLanguage('en');
});

// ---- App-side warnings ----------------------------------------------------

test('no warning before the first status arrives', () => {
  assert.deepEqual(appWarnings({ nowMs: 100_000, lastStatusAtMs: null, batteryLevel: 0.9 }), []);
});

test('pod far warning appears at exactly 6 s of silence, not before', () => {
  setCurrentLanguage('en');
  const last = 1_000_000;
  assert.deepEqual(
    appWarnings({ nowMs: last + POD_SILENT_AFTER_MS - 1, lastStatusAtMs: last, batteryLevel: 0.9 }),
    [],
  );
  const w = appWarnings({ nowMs: last + POD_SILENT_AFTER_MS, lastStatusAtMs: last, batteryLevel: 0.9 });
  assert.equal(w.length, 1);
  assert.equal(w[0].key, 'pod_far');
  assert.equal(
    w[0].text,
    "Can't reach the pod. If you walked away from it, walk closer. If it lost power, switch it on. The walk so far is saved.",
  );
});

test('battery warning is under 20 % and names the percentage', () => {
  setCurrentLanguage('en');
  const at = (level: number | null) =>
    appWarnings({ nowMs: 5, lastStatusAtMs: 5, batteryLevel: level });
  assert.deepEqual(at(0.2), []);
  assert.deepEqual(at(0.5), []);
  assert.equal(at(0.19)[0].text, 'Phone battery low (19%). Charge soon.');
  assert.equal(at(0.07)[0].text, 'Phone battery low (7%). Charge soon.');
});

test('an unreadable battery (-1 or null) is not a low battery', () => {
  assert.deepEqual(appWarnings({ nowMs: 5, lastStatusAtMs: 5, batteryLevel: -1 }), []);
  assert.deepEqual(appWarnings({ nowMs: 5, lastStatusAtMs: 5, batteryLevel: null }), []);
});

// ---- Alerts ---------------------------------------------------------------

test('each alert id is fresh exactly once', () => {
  const first = freshAlerts([alert(1), alert(2)], 0);
  assert.deepEqual(first.fresh.map((a) => a.alert_id), [1, 2]);
  assert.equal(first.lastSeenId, 2);

  // The pod repeats the last 20 alerts on every poll.
  const again = freshAlerts([alert(1), alert(2)], first.lastSeenId);
  assert.deepEqual(again.fresh, []);
  assert.equal(again.lastSeenId, 2);

  const next = freshAlerts([alert(1), alert(2), alert(3)], again.lastSeenId);
  assert.deepEqual(next.fresh.map((a) => a.alert_id), [3]);
  assert.equal(next.lastSeenId, 3);
});

test('alerts that arrive out of order are still counted once and in order', () => {
  const r = freshAlerts([alert(5), alert(3), alert(4)], 3);
  assert.deepEqual(r.fresh.map((a) => a.alert_id), [4, 5]);
  assert.equal(r.lastSeenId, 5);
});

test('no alerts is fine', () => {
  assert.deepEqual(freshAlerts(null, 4), { fresh: [], lastSeenId: 4 });
  assert.deepEqual(freshAlerts(undefined, 0), { fresh: [], lastSeenId: 0 });
  assert.equal(highestAlertId([]), 0);
  assert.equal(highestAlertId([alert(2), alert(9), alert(4)]), 9);
});

// ---- Time -----------------------------------------------------------------

test('the phone time sent to the pod has no milliseconds', () => {
  assert.equal(toPodUtc(new Date('2026-10-03T04:30:12.345Z')), '2026-10-03T04:30:12Z');
});

test('the timer carries on between polls and stops at the pod limit', () => {
  assert.equal(displayElapsed(312, 10_000, 10_000, 1800), 312);
  assert.equal(displayElapsed(312, 10_000, 12_900, 1800), 314);
  assert.equal(displayElapsed(1799, 0, 5_000, 1800), 1800);
  assert.equal(displayElapsed(undefined, 0, 5_000, 1800), null);
  assert.equal(displayElapsed(10, null, 5_000, 1800), null);
});

test('timer formatting', () => {
  assert.equal(formatTimer(0), '0:00');
  assert.equal(formatTimer(312), '5:12');
  assert.equal(formatTimer(59), '0:59');
  assert.equal(formatTimer(1800), '30:00');
  assert.equal(formatTimer(3725), '1:02:05');
  assert.equal(formatTimer(-4), '0:00');
});

// ---- Location fixes -------------------------------------------------------

test('a phone location becomes a track fix', () => {
  const f = toTrackFix(
    { latitude: 26.84671, longitude: 80.94622, accuracy: 4.04, speed: 0.6 },
    Date.parse('2026-10-03T04:34:38.900Z'),
  );
  assert.deepEqual(f, {
    utc: '2026-10-03T04:34:38Z',
    lat: 26.84671,
    lon: 80.94622,
    accuracy_m: 4,
    speed_mps: 0.6,
  });
});

test('a fix with no accuracy is dropped; an unknown speed is null', () => {
  const t = Date.parse('2026-10-03T04:34:38Z');
  assert.equal(toTrackFix({ latitude: 1, longitude: 2, accuracy: null, speed: 0 }, t), null);
  assert.equal(toTrackFix({ latitude: NaN, longitude: 2, accuracy: 3, speed: 0 }, t), null);
  assert.equal(toTrackFix({ latitude: 1, longitude: 2, accuracy: 3, speed: -1 }, t)?.speed_mps, null);
  assert.equal(toTrackFix({ latitude: 1, longitude: 2, accuracy: 3, speed: null }, t)?.speed_mps, null);
});

// ---- Track queue ----------------------------------------------------------

test('a flush sends everything and empties the queue', async () => {
  const q = new TrackQueue();
  [1, 2, 3].forEach((n) => q.push(fix(n)));
  const batches: TrackFix[][] = [];
  const sent = await q.flush(async (b) => void batches.push(b));
  assert.equal(sent, 3);
  assert.equal(q.size, 0);
  assert.equal(batches.length, 1);
});

test('a failed send keeps every fix and the next flush retries them', async () => {
  const q = new TrackQueue();
  [1, 2, 3].forEach((n) => q.push(fix(n)));
  const sent1 = await q.flush(async () => {
    throw new Error('offline');
  });
  assert.equal(sent1, 0);
  assert.equal(q.size, 3);

  // Two more arrive while the pod is unreachable.
  q.push(fix(4));
  q.push(fix(5));
  const got: TrackFix[] = [];
  const sent2 = await q.flush(async (b) => void got.push(...b));
  assert.equal(sent2, 5);
  assert.deepEqual(got.map((f) => f.lat), [1, 2, 3, 4, 5].map((n) => fix(n).lat));
  assert.equal(q.size, 0);
});

test('a large backlog goes in batches and stops at the first failure', async () => {
  const q = new TrackQueue();
  for (let i = 0; i < TRACK_BATCH * 2 + 10; i++) q.push(fix(i));
  let calls = 0;
  const sent = await q.flush(async () => {
    calls++;
    if (calls === 2) throw new Error('dropped');
  });
  assert.equal(sent, TRACK_BATCH);
  assert.equal(q.size, TRACK_BATCH + 10);
});

test('fixes pushed while a send is in flight are not lost or double-sent', async () => {
  const q = new TrackQueue();
  q.push(fix(1));
  const seen: number[] = [];
  let pushed = false;
  const sent = await q.flush(async (b) => {
    if (!pushed) {
      pushed = true;
      q.push(fix(2));
    }
    seen.push(b.length);
  });
  // The one that arrived mid-send goes out in the next batch, once.
  assert.equal(sent, 2);
  assert.deepEqual(seen, [1, 1]);
  assert.equal(q.size, 0);
});

test('a second flush while one is running does nothing', async () => {
  const q = new TrackQueue();
  q.push(fix(1));
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  const first = q.flush(() => gate);
  const second = await q.flush(async () => {
    throw new Error('should not run');
  });
  assert.equal(second, 0);
  release();
  assert.equal(await first, 1);
});

test('the queue is capped, dropping the oldest', () => {
  const q = new TrackQueue(3);
  [1, 2, 3, 4, 5].forEach((n) => q.push(fix(n)));
  assert.equal(q.size, 3);
});
