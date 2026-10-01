/**
 * The guard is the only thing standing between a language model and a farmer's
 * screen, so it is tested the way validate.test.ts tests the schema rules: not
 * just that it passes good input, but that it actually fires on bad input.
 *
 * A guard that has never been seen to reject something is not a guard.
 *
 *   npm test
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { allowedFigures, canon, checkFigures } from './guard.ts';

// .href keeps this a string: the app's tsconfig pulls in the DOM lib, whose URL
// type is not assignable to node:url's. Same trick as validate.test.ts.
const FIXTURE_DIR = fileURLToPath(new URL('../../fixtures/', import.meta.url).href);

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(`${FIXTURE_DIR}${name}.json`, 'utf8'));

/** Every advisory we ship, including the one captured off the real device. */
const FIXTURE_NAMES = [
  'advisory-device-capture',
  'advisory-healthy',
  'advisory-failed-tier',
  'advisory-recalled-dose',
  'advisory-trap-above-etl',
  'advisory-uncertain',
];

const healthy = fixture('advisory-healthy');

// ---- canon ----------------------------------------------------------------

test('canon collapses equivalent renderings of the same number', () => {
  assert.equal(canon('0.880'), canon('0.88'));
  assert.equal(canon('1,200'), canon('1200'));
  assert.equal(canon('42.0'), canon('42'));
});

test('canon rejects what is not a number', () => {
  assert.equal(canon(''), null);
  assert.equal(canon('.'), null);
});

// ---- allowedFigures -------------------------------------------------------

test('allowed figures include numbers nested anywhere in the advisory', () => {
  const allowed = allowedFigures({
    a: 1,
    b: { c: [2, { d: 3 }] },
  });
  for (const n of ['1', '2', '3']) assert.ok(allowed.has(n), `missing ${n}`);
});

test('allowed figures include numbers inside strings', () => {
  // A citation and a timestamp are both quotable by an explanation.
  const allowed = allowedFigures({
    threshold_source: 'NIPHM Sugarcane.pdf p.11',
    generated_at_utc: '2026-09-08T14:32:11Z',
  });
  assert.ok(allowed.has('11'), 'page number from a citation');
  assert.ok(allowed.has('2026'), 'year from a timestamp');
});

test('a ratio may be written back as a percentage', () => {
  const allowed = allowedFigures({ confidence: 0.88 });
  assert.ok(allowed.has('88'), '0.88 should permit "88%"');
});

test('a percentage rendering is not permitted for values above 1', () => {
  const allowed = allowedFigures({ crop_et_mm_day: 21.4 });
  assert.ok(!allowed.has('2140'), '21.4 must not permit "2140"');
});

// ---- checkFigures: the happy path -----------------------------------------

test('prose with no digits at all passes', () => {
  const result = checkFigures(
    'Your crop looks healthy. Keep watching the traps and water as usual.',
    healthy,
  );
  assert.equal(result.ok, true);
});

test('quoting a figure that is in the advisory passes', () => {
  const a = { pest: [{ count_observed: 42, threshold_value: 100 }] };
  const result = checkFigures('Trap counts are at 42, well below the threshold of 100.', a);
  assert.equal(result.ok, true);
});

test('list numbering is structure, not a claim', () => {
  const a = { actions: [{ rank: 1, action: 'x' }] };
  const result = checkFigures('1. Water the field.\n2. Check the traps.\n3. Wait.', a);
  assert.equal(result.ok, true, 'ordinals opening a line must not be treated as figures');
});

test('bullet markers are stripped too', () => {
  const result = checkFigures('- Water the field.\n• Check the traps.', {});
  assert.equal(result.ok, true);
});

// ---- checkFigures: the rejections that matter -----------------------------

test('an invented dose is rejected', () => {
  const result = checkFigures('Spray 7.5 ml per litre of water.', healthy);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.offending.map((f) => f.raw),
    ['7.5'],
  );
});

/**
 * A property of the design that is worth pinning rather than discovering.
 *
 * The guard allows any figure the advisory contains, including ones inside
 * prose — a citation, an accuracy note, a note to the farmer. That is
 * deliberate: anything the advisory says, the explanation may repeat. But it
 * means **every sentence of prose the pod adds widens the allow-list.**
 *
 * Every advisory carries "approximately 2.5 m CEP" in its GPS accuracy note, so
 * 2.5 is a figure the model may legitimately write — including, in principle,
 * as "2.5 ml per litre". The guard is a floor, not a ceiling: it stops figures
 * appearing from nowhere, and the prompt is what stops a real figure being
 * reused as something it is not.
 *
 * If this ever needs tightening, the move is to exclude free-prose fields from
 * the allow-list, not to weaken what the model may quote.
 */
test('figures inside advisory prose widen what the model may write', () => {
  assert.ok(
    allowedFigures(healthy).has('2.5'),
    'the GPS accuracy note puts 2.5 in the advisory, so the guard must allow it',
  );
  assert.equal(checkFigures('Fixes are good to about 2.5 m.', healthy).ok, true);
});

test('an invented day count is rejected', () => {
  const a = { pest: [{ days_monitored: 9 }] };
  const result = checkFigures('Irrigate within the next 3 days.', a);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.offending[0].raw, '3');
});

test('an invented price is rejected', () => {
  const result = checkFigures('Treatment costs about Rs 450 per acre.', healthy);
  assert.equal(result.ok, false);
});

test('every offending figure is reported, not just the first', () => {
  const result = checkFigures('Use 2.5 ml in 15 litres every 7 days.', {});
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.offending.map((f) => f.raw).sort(),
    ['15', '2.5', '7'],
  );
});

test('a repeated invented figure is reported once', () => {
  const result = checkFigures('Use 2.5 ml. Always 2.5 ml, never more.', {});
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.offending.length, 1);
});

test('a plausible-but-wrong version of a real figure is rejected', () => {
  // The advisory says 42. The model rounding it to 40 is still a number the
  // pipeline never produced, and this is exactly the quiet failure we care
  // about: it looks like a measurement and reads as one.
  const a = { pest: [{ count_observed: 42 }] };
  const result = checkFigures('Trap counts are around 40.', a);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.offending[0].raw, '40');
});

// ---- checkFigures against the real fixtures -------------------------------

test('every fixture permits an explanation that quotes its own figures', () => {
  for (const name of FIXTURE_NAMES) {
    const a = fixture(name) as Record<string, unknown>;
    const allowed = allowedFigures(a);
    assert.ok(allowed.size > 0, `${name} produced no allowed figures`);
    // The advisory id itself is a timestamp; quoting the date back must pass.
    const id = String((a as { advisory_id: string }).advisory_id);
    const result = checkFigures(`This advisory is ${id}.`, a);
    assert.equal(result.ok, true, `${name}: quoting its own id was rejected`);
  }
});

test('an invented figure is caught in every fixture', () => {
  for (const name of FIXTURE_NAMES) {
    const a = fixture(name);
    // 999999 appears in none of them.
    const result = checkFigures('Apply 999999 units immediately.', a);
    assert.equal(result.ok, false, `${name}: guard did not fire`);
  }
});
