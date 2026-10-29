import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setCurrentLanguage } from '../i18n/tr.ts';
import { appWarnings } from './logic.ts';
import type { ScanAlert, ScanStatus, TrackFix } from './logic.ts';
import { LOST_AFTER_IDLE_POLLS, ScanSessionCore } from './session-core.ts';
import type { LocationNote } from './session-core.ts';

setCurrentLanguage('en');

const alert = (id: number): ScanAlert => ({
  alert_id: id,
  utc: '2026-10-03T04:34:40Z',
  class: 'wheat__brown_rust',
  frames_agreeing: 4,
  lat: 26.8467,
  lon: 80.9462,
  pos_accuracy_m: 4,
});

const scanning = (over: Partial<ScanStatus> = {}): ScanStatus => ({
  state: 'scanning',
  scan_id: 'S1',
  field_id: 'F01',
  crop: 'wheat',
  replay: false,
  elapsed_s: 10,
  max_duration_s: 1800,
  counts: { stretches: 1, healthy: 1, need_look: 0, unclear: 0 },
  warnings: [],
  alerts: [],
  advisory_id: null,
  stop_reason: null,
  ...over,
});

const fix = (n: number): TrackFix => ({
  utc: '2026-10-03T04:34:38Z',
  lat: 26 + n / 1000,
  lon: 80,
  accuracy_m: 4,
  speed_mps: 0.5,
});

/** A pod, a phone and a clock, all under the test's control. */
function rig() {
  let now = 1_000_000;
  let flushTimeout: () => void = () => {};
  const flushTimeoutPromise = new Promise<void>((r) => (flushTimeout = r));

  const r = {
    status: scanning() as ScanStatus | Error,
    podAnswers: true,
    trackFails: false,
    trackHangs: false,
    stopFails: false,
    pullFailures: 0,
    battery: 0.9 as number | null,
    locationNote: 'on' as LocationNote,
    statusDelay: null as Promise<void> | null,

    vibrations: [] as number[],
    tracks: [] as { scanId: string; fixes: TrackFix[] }[],
    stops: [] as string[],
    pulls: [] as string[],
    keepAwake: [] as boolean[],
    pollCount: 0,
    watchers: 0,
    watchersStopped: 0,
    emit: null as null | ((f: TrackFix) => void),
    expireFlushTimeout: () => flushTimeout(),
    advance: (ms: number) => void (now += ms),
  };

  const core = new ScanSessionCore({
    now: () => now,
    async getStatus() {
      r.pollCount++;
      if (r.statusDelay) await r.statusDelay;
      if (!r.podAnswers || r.status instanceof Error) throw new Error('unreachable');
      return r.status;
    },
    async postTrack(scanId, fixes) {
      if (r.trackHangs) await new Promise<void>(() => {});
      if (r.trackFails) throw new Error('offline');
      r.tracks.push({ scanId, fixes });
    },
    async stopScan(scanId) {
      if (r.stopFails) throw new Error('Could not reach the pod');
      r.stops.push(scanId);
    },
    async pullAdvisory(id) {
      if (r.pullFailures > 0) {
        r.pullFailures--;
        throw new Error('link dropped');
      }
      r.pulls.push(id);
      return { advisoryId: id, valid: true };
    },
    vibrate: (n) => void r.vibrations.push(n),
    readBattery: async () => r.battery,
    async watchLocation(onFix) {
      r.watchers++;
      r.emit = onFix;
      return {
        stop: () => void r.watchersStopped++,
        note: r.locationNote,
      };
    },
    keepAwake: (on) => void r.keepAwake.push(on),
    // The retry pause is instant; the final-flush timeout only fires on demand.
    sleep: (ms) => (ms === 2500 ? flushTimeoutPromise : Promise.resolve()),
  });

  /** One second passes and the heartbeat fires. */
  const second = async () => {
    r.advance(1000);
    await core.tick();
  };
  const seconds = async (n: number) => {
    for (let i = 0; i < n; i++) await second();
  };
  const start = () =>
    core.begin({ scanId: 'S1', fieldId: 'F01', crop: 'wheat', replay: false });

  return { r, core, second, seconds, start };
}

test('starting a walk keeps the screen awake and begins tracking', async () => {
  const { r, core, start } = rig();
  start();
  await Promise.resolve();
  assert.equal(core.getState().phase, 'running');
  assert.equal(core.getState().scanId, 'S1');
  assert.deepEqual(r.keepAwake, [true]);
  assert.equal(r.watchers, 1);
});

test('the live status is polled every second and kept', async () => {
  const { r, core, second, start } = rig();
  start();
  r.status = scanning({ elapsed_s: 12, thermal_c_latest: 29.4 });
  await second();
  assert.equal(core.getState().status?.thermal_c_latest, 29.4);
  assert.notEqual(core.getState().statusAtMs, null);
  await second();
  assert.equal(r.pollCount, 2);
});

test('a slow status poll does not pile more polls up behind it', async () => {
  const { r, second, start } = rig();
  start();
  let release: () => void = () => {};
  r.statusDelay = new Promise<void>((res) => (release = res));
  const first = second();
  await Promise.resolve();
  await second();
  await second();
  assert.equal(r.pollCount, 1);
  release();
  await first;
});

test('the phone vibrates once for each new alert id and never again for it', async () => {
  const { r, second, start } = rig();
  start();
  r.status = scanning({ alerts: [] });
  await second();
  assert.deepEqual(r.vibrations, []);

  r.status = scanning({ alerts: [alert(1)] });
  await second();
  assert.deepEqual(r.vibrations, [1]);

  // The pod keeps listing the last 20 alerts every second.
  await second();
  await second();
  assert.deepEqual(r.vibrations, [1]);

  r.status = scanning({ alerts: [alert(1), alert(2)] });
  await second();
  assert.deepEqual(r.vibrations, [1, 1]);
});

test('two alerts arriving in one poll buzz twice', async () => {
  const { r, second, start } = rig();
  start();
  r.status = scanning({ alerts: [alert(1), alert(2)] });
  await second();
  assert.deepEqual(r.vibrations, [2]);
});

test('joining a walk already in progress does not buzz for old alerts, only new ones', async () => {
  const { r, core, second } = rig();
  r.status = scanning({ alerts: [alert(1), alert(2)] });
  core.attach(r.status);
  await second();
  assert.deepEqual(r.vibrations, []);
  assert.equal(core.getState().scanId, 'S1');

  r.status = scanning({ alerts: [alert(1), alert(2), alert(3)] });
  await second();
  assert.deepEqual(r.vibrations, [1]);
});

test('no answer for 6 s raises the too-far warning, and an answer clears it', async () => {
  const { r, core, second, seconds, start } = rig();
  start();
  await second();
  const warned = () =>
    appWarnings({
      nowMs: core.getState().nowMs,
      lastStatusAtMs: core.getState().statusAtMs,
      batteryLevel: null,
    }).map((w) => w.key);
  assert.deepEqual(warned(), []);

  r.podAnswers = false;
  await seconds(5);
  assert.deepEqual(warned(), []);
  await seconds(1);
  assert.deepEqual(warned(), ['pod_far']);
  // The pod is still scanning as far as the phone knows: the walk carries on.
  assert.equal(core.getState().phase, 'running');

  r.podAnswers = true;
  await second();
  assert.deepEqual(warned(), []);
});

test('a battery under 20 % raises the warning from the first read', async () => {
  const { r, core, second, start } = rig();
  r.battery = 0.18;
  start();
  await second();
  const w = appWarnings({
    nowMs: core.getState().nowMs,
    lastStatusAtMs: core.getState().statusAtMs,
    batteryLevel: core.getState().batteryLevel,
  });
  assert.equal(w.length, 1);
  assert.equal(w[0].text, 'Phone battery low (18%). Charge soon.');
});

// ---- Phone GPS ------------------------------------------------------------

test('fixes go to the pod in batches about every 5 s', async () => {
  const { r, seconds, start } = rig();
  start();
  await Promise.resolve();
  r.emit?.(fix(1));
  r.emit?.(fix(2));
  await seconds(4);
  assert.equal(r.tracks.length, 0);
  await seconds(1);
  assert.equal(r.tracks.length, 1);
  assert.equal(r.tracks[0].scanId, 'S1');
  assert.equal(r.tracks[0].fixes.length, 2);

  // Nothing waiting, nothing sent.
  await seconds(5);
  assert.equal(r.tracks.length, 1);
});

test('fixes taken while the pod is out of reach are sent when it comes back', async () => {
  const { r, seconds, start } = rig();
  start();
  await Promise.resolve();
  r.trackFails = true;
  r.emit?.(fix(1));
  await seconds(5);
  r.emit?.(fix(2));
  await seconds(5);
  assert.equal(r.tracks.length, 0);

  r.trackFails = false;
  r.emit?.(fix(3));
  await seconds(5);
  const sent = r.tracks.flatMap((t) => t.fixes);
  assert.deepEqual(sent.map((f) => f.lat), [fix(1).lat, fix(2).lat, fix(3).lat]);
});

test('refused location permission is noted and the walk carries on', async () => {
  const { r, core, second, start } = rig();
  r.locationNote = 'denied';
  start();
  await Promise.resolve();
  await second();
  assert.equal(core.getState().location, 'denied');
  assert.equal(core.getState().phase, 'running');
});

// ---- Stop and the report --------------------------------------------------

test('Stop flushes the last positions, stops tracking, then tells the pod', async () => {
  const { r, core, start } = rig();
  start();
  await Promise.resolve();
  r.emit?.(fix(1));

  await core.requestStop();
  assert.equal(core.getState().phase, 'stopping');
  assert.equal(r.watchersStopped, 1);
  assert.equal(r.tracks.length, 1, 'the last fix went out before stopping');
  assert.deepEqual(r.stops, ['S1']);
});

test('Stop is not held up by a pod that cannot take the last positions', async () => {
  const { r, core, start } = rig();
  start();
  await Promise.resolve();
  r.emit?.(fix(1));
  r.trackFails = true;
  await core.requestStop();
  assert.deepEqual(r.stops, ['S1']);
});

test('Stop can proceed even if the final flush hangs', async () => {
  const { r, core, start } = rig();
  start();
  await Promise.resolve();
  r.emit?.(fix(1));
  r.trackHangs = true;
  const stopping = core.requestStop();
  await Promise.resolve();
  r.expireFlushTimeout();
  await stopping;
  assert.deepEqual(r.stops, ['S1']);
});

test('a Stop the pod never heard puts the walk back to running with the reason', async () => {
  const { r, core, start } = rig();
  start();
  await Promise.resolve();
  r.stopFails = true;
  await core.requestStop();
  assert.equal(core.getState().phase, 'running');
  assert.equal(core.getState().stopError, 'Could not reach the pod');
  assert.equal(r.watchers, 2, 'tracking is started again');

  r.stopFails = false;
  await core.requestStop();
  assert.equal(core.getState().phase, 'stopping');
  assert.equal(core.getState().stopError, null);
  assert.deepEqual(r.stops, ['S1']);
});

test('Finishing... until the pod says done, then the report is fetched and acknowledged by id', async () => {
  const { r, core, second, start } = rig();
  start();
  await Promise.resolve();
  await core.requestStop();

  r.status = scanning({ state: 'finalizing' });
  await second();
  assert.equal(core.getState().phase, 'stopping');
  assert.deepEqual(r.pulls, []);

  r.status = scanning({ state: 'done', advisory_id: '2026-10-03T04:30:12Z_F01', stop_reason: 'user' });
  await second();
  assert.deepEqual(r.pulls, ['2026-10-03T04:30:12Z_F01']);
  assert.equal(core.getState().phase, 'report');
  assert.equal(core.getState().advisoryId, '2026-10-03T04:30:12Z_F01');
  assert.equal(r.keepAwake.at(-1), false);

  // Done means done: no more polling after the report is in hand.
  const polls = r.pollCount;
  await second();
  assert.equal(r.pollCount, polls);
});

test('the pod stopping the walk by itself (time limit) goes the same way', async () => {
  const { r, core, second, start } = rig();
  start();
  await Promise.resolve();
  r.status = scanning({ state: 'finalizing', stop_reason: 'time_limit' });
  await second();
  assert.equal(r.watchersStopped, 1, 'phone stops tracking once the pod is finalizing');
  r.status = scanning({ state: 'done', advisory_id: 'ADV1', stop_reason: 'time_limit' });
  await second();
  assert.equal(core.getState().phase, 'report');
});

test('a report fetch that drops twice is retried and succeeds', async () => {
  const { r, core, second, start } = rig();
  start();
  await Promise.resolve();
  r.pullFailures = 2;
  r.status = scanning({ state: 'done', advisory_id: 'ADV1' });
  await second();
  assert.equal(core.getState().phase, 'report');
  assert.deepEqual(r.pulls, ['ADV1']);
});

test('a report that cannot be fetched is a failure with a retry, not a lost walk', async () => {
  const { r, core, second, start } = rig();
  start();
  await Promise.resolve();
  r.pullFailures = 3;
  r.status = scanning({ state: 'done', advisory_id: 'ADV1' });
  await second();
  assert.equal(core.getState().phase, 'failed');
  assert.equal(core.getState().advisoryId, 'ADV1');
  assert.equal(core.getState().error, 'link dropped');

  await core.retryReport();
  assert.equal(core.getState().phase, 'report');
  assert.deepEqual(r.pulls, ['ADV1']);
});

test('done with no advisory id is reported, not silently dropped', async () => {
  const { r, core, second, start } = rig();
  start();
  await Promise.resolve();
  r.status = scanning({ state: 'done', advisory_id: null });
  await second();
  assert.equal(core.getState().phase, 'failed');
  assert.match(core.getState().error ?? '', /did not name a report/);
});

test('an error with no report ends the walk with a message', async () => {
  const { r, core, second, start } = rig();
  start();
  await Promise.resolve();
  r.status = scanning({ state: 'error', stop_reason: 'error' });
  await second();
  assert.equal(core.getState().phase, 'failed');
  assert.match(core.getState().error ?? '', /problem/);
});

test('an error that still produced a report opens the report', async () => {
  const { r, core, second, start } = rig();
  start();
  await Promise.resolve();
  r.status = scanning({ state: 'error', advisory_id: 'ADV2', stop_reason: 'error' });
  await second();
  assert.equal(core.getState().phase, 'report');
});

// ---- Losing the pod -------------------------------------------------------

test('a pod that keeps saying idle means the scan is gone', async () => {
  const { r, core, seconds, start } = rig();
  start();
  await Promise.resolve();
  r.status = scanning({ state: 'idle', scan_id: null });
  await seconds(LOST_AFTER_IDLE_POLLS - 1);
  assert.equal(core.getState().phase, 'running');
  await seconds(1);
  assert.equal(core.getState().phase, 'lost');
  assert.equal(r.keepAwake.at(-1), false);
});

test('one idle blip while starting does not lose the walk', async () => {
  const { r, core, second, seconds, start } = rig();
  start();
  await Promise.resolve();
  r.status = scanning({ state: 'idle', scan_id: null });
  await second();
  r.status = scanning({ state: 'starting' });
  await second();
  r.status = scanning();
  await seconds(LOST_AFTER_IDLE_POLLS);
  assert.equal(core.getState().phase, 'running');
});

test('a status that belongs to a different scan is ignored', async () => {
  const { r, core, second, start } = rig();
  start();
  await Promise.resolve();
  r.status = scanning({ scan_id: 'OLD', state: 'done', advisory_id: 'OLDADV' });
  await second();
  assert.equal(core.getState().phase, 'running');
  assert.deepEqual(r.pulls, []);
});

test('dismissing clears the session and lets the screen sleep again', async () => {
  const { r, core, start } = rig();
  start();
  await Promise.resolve();
  core.dismiss();
  assert.equal(core.getState().phase, 'idle');
  assert.equal(core.getState().scanId, null);
  assert.equal(r.keepAwake.at(-1), false);
  assert.equal(r.watchersStopped, 1);
});

test('joining a walk that is already finishing goes straight to waiting for the report', async () => {
  const { r, core } = rig();
  r.status = scanning({ state: 'done', advisory_id: 'ADV9' });
  core.attach(r.status);
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(core.getState().phase, 'report');
  assert.deepEqual(r.pulls, ['ADV9']);
  assert.equal(r.watchers, 0, 'no tracking for a walk that has ended');
});
