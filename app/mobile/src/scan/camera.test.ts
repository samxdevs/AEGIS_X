/**
 * The live camera's honesty rules and the capture cards.
 *
 *   npm test
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { setCurrentLanguage } from '../i18n/tr.ts';
import { STALE_AFTER_MS, describeCapture, feedState, readCapture } from './camera.ts';

const base = { lastNewFrameAtMs: 10_000, replay: false, lastStatus: null };

test('new frames make the feed live', () => {
  assert.deepEqual(feedState(base, 10_500), { kind: 'live', replay: false });
});

test('a frozen picture stops claiming to be live', () => {
  // The connection can be perfectly fine while the camera has stalled; only a
  // rising frame number earns "live".
  assert.deepEqual(feedState(base, 10_000 + STALE_AFTER_MS + 1), { kind: 'paused' });
});

test('a replay is never called live camera', () => {
  assert.deepEqual(feedState({ ...base, replay: true }, 10_100), { kind: 'live', replay: true });
});

test('before the first frame it is waiting, not paused', () => {
  assert.deepEqual(feedState({ ...base, lastNewFrameAtMs: null }, 99_999), { kind: 'waiting' });
});

test('an old pod and a broken camera are told apart', () => {
  assert.deepEqual(feedState({ ...base, lastStatus: 404 }, 10_100), { kind: 'unsupported' });
  assert.deepEqual(feedState({ ...base, lastStatus: 503 }, 10_100), { kind: 'unavailable' });
});

const capture = {
  capture_id: 1,
  utc: '2026-10-03T04:34:41Z',
  media_id: 'cap_x_1',
  image_path: '/api/v1/media/cap_x_1',
  quality: 'OK',
  verdict: 'DISEASE',
  top_class: 'wheat__brown_rust',
  confidence: 0.91,
  cross_source_reliability: 'TESTED_WEAK',
  lat: 26.8467,
  lon: 80.9462,
  pos_accuracy_m: 4,
  pos_source: 'phone_gps',
};

test('a capture response is read field by field', () => {
  const c = readCapture(capture);
  assert.equal(c?.verdict, 'DISEASE');
  assert.equal(c?.lat, 26.8467);
});

test('missing or mistyped fields are null, not guesses', () => {
  const c = readCapture({ ...capture, confidence: 'high', lat: undefined, verdict: undefined });
  assert.equal(c?.confidence, null);
  assert.equal(c?.lat, null);
  assert.equal(c?.verdict, 'NO_DATA');
});

test('a response without an id, a time or an image is not a capture', () => {
  assert.equal(readCapture({ ...capture, capture_id: undefined }), null);
  assert.equal(readCapture({ ...capture, image_path: '' }), null);
  assert.equal(readCapture('nope'), null);
});

test('a disease in one photo is only ever possible, with check by eye', () => {
  setCurrentLanguage('en');
  const d = describeCapture(readCapture(capture)!);
  assert.equal(d.tone, 'bad');
  assert.match(d.headline, /^Possible .+\. Check this plant by eye\.$/);
});

test('a photo that failed its quality check says why', () => {
  setCurrentLanguage('en');
  const blurry = describeCapture(readCapture({ ...capture, verdict: 'NO_DATA', quality: 'BLURRY', top_class: null })!);
  assert.match(blurry.headline, /blurry/i);
  const dark = describeCapture(readCapture({ ...capture, verdict: 'NO_DATA', quality: 'TOO_DARK', top_class: null })!);
  assert.match(dark.headline, /dark/i);
});

test('DISEASE without a class is not turned into a diagnosis', () => {
  setCurrentLanguage('en');
  const d = describeCapture(readCapture({ ...capture, top_class: null })!);
  assert.equal(d.tone, 'unknown');
});
