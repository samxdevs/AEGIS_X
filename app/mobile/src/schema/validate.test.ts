/**
 * Runs on Node's built-in test runner with native type stripping — no jest,
 * no babel, no transform step:  npm test
 *
 * Four jobs.
 *
 * First, every fixture we ship must satisfy every rule, so a fixture cannot
 * quietly become the thing that teaches the renderer bad habits.
 *
 * Second — and this is the one that earns its keep — **the advisory the
 * hardware team captured off the real Jetson must pass.** `advisory-device-
 * capture.json` is that file, byte for byte. A validator that rejects reality
 * is worse than no validator: every real advisory would arrive flagged, and a
 * warning that fires on everything is a warning nobody reads.
 *
 * Third, each rule must actually fire when broken — a validator that never
 * rejects anything is a guard defaulted off wearing a test suite as a disguise.
 *
 * Fourth, the *legitimate* degraded states have to pass. CWSI unavailable
 * because the reference pads are unconfigured, every vegetation index withheld
 * because the frame was bare soil, `irrigation` collapsed to two keys because
 * the mast is not deployed, a pest a sticky card cannot sample — all of those
 * are the system working correctly and all of them must validate.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { validateAdvisory, describeViolation, isRenderable, missingBlocks } from './validate.ts';
import type { RuleId } from './validate.ts';
import { isReplay, fieldIdFromAdvisoryId } from './advisory.ts';

// .href keeps this a string: the app's tsconfig pulls in the DOM lib, whose URL
// type is not assignable to node:url's. Passing the href sidesteps the clash.
const FIXTURE_DIR = fileURLToPath(new URL('../../fixtures/', import.meta.url).href);

const loadFixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(FIXTURE_DIR + name, 'utf8'));

const fixtureNames = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));

/** Deep clone so each mutation test starts from a pristine advisory. */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

const rulesFired = (advisory: unknown): RuleId[] => {
  const { violations } = validateAdvisory(advisory);
  return [...new Set(violations.map((v) => v.rule))].sort();
};

// ---- The fixtures ---------------------------------------------------------

test('every shipped fixture satisfies every rule', () => {
  assert.ok(fixtureNames.length >= 5, 'expected at least five fixtures');
  for (const name of fixtureNames) {
    const result = validateAdvisory(loadFixture(name));
    assert.ok(
      result.ok,
      `${name} violates the schema:\n  ${result.violations.map(describeViolation).join('\n  ')}`,
    );
  }
});

/**
 * The fixture that is not ours.
 *
 * This is the real payload from the Jetson Nano, 19 September. If a change to
 * the validator breaks this test, the validator is wrong — not the device.
 */
test('the advisory captured from the real device validates', () => {
  const real = loadFixture('advisory-device-capture.json');
  const result = validateAdvisory(real);
  assert.ok(
    result.ok,
    `the real device capture is being rejected:\n  ${result.violations.map(describeViolation).join('\n  ')}`,
  );
  assert.equal(real.inference_backend, 'trt', 'the device runs TensorRT');
  assert.equal(real.replay, true, 'the captured scan came from a video file');
});

test('the fixtures cover the architecture as it actually is', () => {
  const all = fixtureNames.map((n) => JSON.stringify(loadFixture(n))).join('\n');
  // The drone is gone. A fixture that still speaks of flights would teach the
  // renderer, the prompt and the reader the wrong architecture.
  assert.ok(!/"flight/.test(all), 'a fixture still carries a flight block');
  assert.ok(!/drone/i.test(all), 'a fixture still mentions a drone');
  assert.ok(/handheld_pod/.test(all), 'no fixture runs in handheld_pod mode');
  // Contract v1.0 replaced the old water block with four availability blocks.
  assert.ok(!/"water"\s*:/.test(all), 'a fixture still carries the pre-v1.0 water block');
});

test('every fixture is renderable by the current screen', () => {
  for (const name of fixtureNames) {
    const advisory = loadFixture(name);
    assert.ok(
      isRenderable(advisory),
      `${name} is missing blocks the renderer reads: ${missingBlocks(advisory).join(', ')}`,
    );
  }
});

test('the fixtures exercise the states that are easy to render badly', () => {
  const bodies = fixtureNames.map((n) => loadFixture(n) as Record<string, any>);
  const has = (pred: (a: Record<string, any>) => boolean) => bodies.some(pred);

  // The thermal array working while CWSI is gated on uncalibrated references.
  assert.ok(
    has((a) => a.thermal?.available === false && typeof a.thermal?.tc_c === 'number'),
    'no fixture has a working thermal sensor with CWSI unavailable',
  );
  // A high-confidence finding on a class that fails on held-out cameras.
  assert.ok(
    has((a) =>
      (a.detections ?? []).some(
        (d: any) => d.cross_source_reliability === 'TESTED_FAILED' && d.confidence > 0.9,
      ),
    ),
    'no fixture pairs high confidence with TESTED_FAILED — the case the UI exists for',
  );
  // A dose that must not render like a registered label claim.
  assert.ok(
    has((a) => (a.actions ?? []).some((x: any) => x.verification_status === 'RECALLED_UNVERIFIED')),
    'no fixture carries a RECALLED_UNVERIFIED action',
  );
  // A pest a sticky card is the wrong instrument for.
  assert.ok(
    has((a) => (a.pest ?? []).some((p: any) => p.status === 'NOT_SAMPLED_BY_STICKY_TRAP')),
    'no fixture carries NOT_SAMPLED_BY_STICKY_TRAP',
  );
  // Every vegetation index legitimately withheld.
  assert.ok(
    has((a) => a.vegetation?.canopy_cover?.status === 'INSUFFICIENT_CANOPY'),
    'no fixture has insufficient canopy',
  );
  // The whole irrigation block collapsed to availability plus a reason.
  assert.ok(
    has((a) => a.irrigation?.available === false),
    'no fixture has irrigation unavailable',
  );
  // And at least one where everything did work, so the good path is covered.
  assert.ok(
    has((a) => a.thermal?.available === true && a.irrigation?.available === true),
    'no fixture has a fully available advisory',
  );
});

// ---- Rule 1: absence is null plus a reason --------------------------------

test('rule 1 fires when a null carries no reason', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  a.scan.distance_walked_m = null;
  delete a.scan.distance_reason;
  assert.ok(rulesFired(a).includes(1));
});

test('rule 1 fires when an availability block is false with no reason', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  a.ndvi_satellite.available = false;
  a.ndvi_satellite.reason = null;
  assert.ok(rulesFired(a).includes(1));
});

test('rule 1 fires when a vegetation index is withheld without saying why', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  a.vegetation.dgci.mean = null;
  delete a.vegetation.dgci.reason;
  assert.ok(rulesFired(a).includes(1));
});

test('rule 1 fires when CWSI appears on a block that calls itself unavailable', () => {
  const a = clone(loadFixture('advisory-recalled-dose.json')) as any;
  a.thermal.cwsi = 0.42;
  assert.ok(rulesFired(a).includes(1));
});

test('rule 1 fires when an unclamped CWSI is out of range with no flag', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  a.thermal.cwsi = 1.4;
  a.thermal.flag = null;
  assert.ok(rulesFired(a).includes(1));
});

test('rule 1 fires when a non-definitive verdict gives no reason', () => {
  const a = clone(loadFixture('advisory-uncertain.json')) as any;
  a.crop_health.reason = null;
  assert.ok(rulesFired(a).includes(1));
});

test('rule 1 fires when a detection has one coordinate but not the other', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  a.detections[0].lon = null;
  assert.ok(rulesFired(a).includes(1));
});

test('rule 1 fires when the advisory does not say which engine ran', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  delete a.inference_backend;
  assert.ok(rulesFired(a).includes(1));
});

test('rule 1 fires when a pest claims a threshold it does not carry', () => {
  const a = clone(loadFixture('advisory-trap-above-etl.json')) as any;
  a.pest[0].threshold_value = null;
  assert.ok(rulesFired(a).includes(1));
});

// ---- Rule 2: thresholds carry source and confirmation ---------------------

test('rule 2 fires when a vegetation index has no confirmation flag', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  delete a.vegetation.vari.threshold_confirmed;
  assert.ok(rulesFired(a).includes(2));
});

test('rule 2 fires when a pest threshold arrives with no unit', () => {
  const a = clone(loadFixture('advisory-trap-above-etl.json')) as any;
  a.pest[0].threshold_unit = null;
  assert.ok(rulesFired(a).includes(2));
});

test('rule 2 does not fire on an absent threshold with a status explaining it', () => {
  // Twelve of fifteen registry taxa have no published limit. That is the source
  // being honest, and flagging it would make the validator useless.
  const a = clone(loadFixture('advisory-trap-above-etl.json')) as any;
  const unsampled = a.pest.find((p: any) => p.status === 'NOT_SAMPLED_BY_STICKY_TRAP');
  assert.equal(unsampled.threshold_value, null);
  assert.ok(!rulesFired(a).includes(2));
});

// ---- Rule 3: inputs[] mandatory and complete ------------------------------

test('rule 3 fires when inputs[] is missing entirely', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  delete a.inputs;
  assert.ok(rulesFired(a).includes(3));
});

test('rule 3 fires when a value was produced from an undeclared sensor', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  a.inputs = a.inputs.filter((i: any) => i.name !== 'pod_camera_rgb');
  assert.ok(rulesFired(a).includes(3));
});

test('rule 3 fires on an input status this build does not recognise', () => {
  // An unknown *status* is the dangerous one: there is no tone to map it to, so
  // it would render as something. An unknown *name* is just a new sensor.
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  a.inputs[0].status = 'DEGRADED';
  assert.ok(rulesFired(a).includes(3));
});

test('rule 3 tolerates a sensor name this build has not heard of', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  a.inputs.push({ name: 'pod_lidar', source_node: 'POD', status: 'OK' });
  assert.ok(!rulesFired(a).includes(3));
});

// ---- Rule 4: source on every numeric block --------------------------------

test('rule 4 fires when a numeric block does not declare its source', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  delete a.vegetation.vari.source;
  assert.ok(rulesFired(a).includes(4));
});

test('rule 4 fires when a detection does not declare its source', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  delete a.detections[0].source;
  assert.ok(rulesFired(a).includes(4));
});

test('rule 4 accepts derived_fao56 on the irrigation block', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  assert.equal(a.irrigation.source, 'derived_fao56');
  assert.ok(!rulesFired(a).includes(4));
});

// ---- Rule 5: citation provenance ------------------------------------------

test('rule 5 fires when a detection states no cross-source reliability', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  delete a.detections[0].cross_source_reliability;
  assert.ok(rulesFired(a).includes(5));
});

test('rule 5 fires on a reliability tier outside the frozen four', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  a.detections[0].cross_source_reliability = 'PROBABLY_FINE';
  assert.ok(rulesFired(a).includes(5));
});

test('rule 5 fires when an action declares no verification status', () => {
  const a = clone(loadFixture('advisory-failed-tier.json')) as any;
  delete a.actions[0].verification_status;
  assert.ok(rulesFired(a).includes(5));
});

/**
 * The registry carries `verification_status` in two places precisely because a
 * localised view renders from the template table and may never read the English
 * rationale. If the two disagree, one of them is lying to somebody.
 */
test('rule 5 fires when the two verification statuses disagree', () => {
  const a = clone(loadFixture('advisory-failed-tier.json')) as any;
  a.actions[0].params.verification_status = 'RECALLED_UNVERIFIED';
  assert.ok(rulesFired(a).includes(5));
});

test('rule 5 fires when a WEB_VERIFIED action cannot be traced anywhere', () => {
  const a = clone(loadFixture('advisory-failed-tier.json')) as any;
  a.actions[0].url = null;
  a.actions[0].document_reference = null;
  assert.ok(rulesFired(a).includes(5));
});

test('rule 5 fires on a template id outside the registry of 21', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  a.actions[0].template_id = 'ACT_INVENT_SOMETHING';
  assert.ok(rulesFired(a).includes(5));
});

// ---- Actions ---------------------------------------------------------------

test('an action that does not declare itself advisory-only is a violation', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  a.actions[0].advisory_only = false;
  assert.ok(!validateAdvisory(a).ok);
});

test('an action claiming to be model-generated is a violation', () => {
  // The pod has no generative layer. Anything not stamped "template" did not
  // come from it, and pretending otherwise is the failure this catches.
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  a.actions[0].generated_by = 'llm';
  assert.ok(!validateAdvisory(a).ok);
});

// ---- Degraded states that must pass ---------------------------------------

test('a scan with no GPS fix at all is valid', () => {
  const a = loadFixture('advisory-recalled-dose.json') as any;
  assert.equal(a.gps.status, 'ABSENT');
  assert.ok(a.detections.every((d: any) => d.lat === null));
  assert.ok(validateAdvisory(a).ok);
});

test('an advisory with every vegetation index withheld is valid', () => {
  const a = loadFixture('advisory-recalled-dose.json') as any;
  for (const key of ['vari', 'exg', 'tgi', 'dgci']) {
    assert.equal(a.vegetation[key].mean, null, `${key} should be withheld`);
    assert.ok(a.vegetation[key].reason, `${key} should say why`);
  }
  assert.ok(validateAdvisory(a).ok);
});

test('an irrigation block of exactly two keys is valid', () => {
  // This is what the real device emits with no ground mast deployed. If the
  // validator ever demands the full FAO-56 table, every real advisory fails.
  const a = loadFixture('advisory-device-capture.json') as any;
  assert.deepEqual(Object.keys(a.irrigation).sort(), ['available', 'reason']);
  assert.ok(validateAdvisory(a).ok);
});

test('a growth stage status the contract enum does not list is tolerated', () => {
  // The device emits CROP_NOT_SPECIFIED; the contract's table does not carry
  // it. Rejecting it would fail a real advisory over a documentation gap.
  const a = loadFixture('advisory-device-capture.json') as any;
  assert.equal(a.growth_stage.status, 'CROP_NOT_SPECIFIED');
  assert.ok(validateAdvisory(a).ok);
});

test('microsecond capture stamps with a numeric offset are accepted', () => {
  // detections[].captured_utc arrives as 2026-09-19T13:16:09.756865+00:00 —
  // still an unambiguous UTC instant, just not the second-resolution Z form the
  // document-level timestamps use.
  const a = loadFixture('advisory-device-capture.json') as any;
  assert.match(a.detections[0].captured_utc, /\+00:00$/);
  assert.ok(validateAdvisory(a).ok);
});

test('an empty pest list is valid', () => {
  const a = loadFixture('advisory-failed-tier.json') as any;
  assert.deepEqual(a.pest, []);
  assert.ok(validateAdvisory(a).ok);
});

// ---- Provenance -----------------------------------------------------------

test('a missing replay field reads as replay, not as live', () => {
  // The failure we care about is a seeded record labelled live, not a live
  // record labelled seeded. A dropped field has to produce the safe error.
  assert.equal(isReplay({}), true);
  assert.equal(isReplay(undefined), true);
  assert.equal(isReplay({ replay: true }), true);
  assert.equal(isReplay({ replay: false }), false);
});

test('a missing replay field is still a schema violation', () => {
  const a = clone(loadFixture('advisory-healthy.json')) as any;
  delete a.replay;
  assert.ok(rulesFired(a).includes(1));
});

test('the field id is parsed off an advisory id only when one is there', () => {
  assert.equal(fieldIdFromAdvisoryId('2026-09-19T13:16:18Z_F01'), 'F01');
  assert.equal(fieldIdFromAdvisoryId('adv-with-no-suffix'), null);
});

// ---- Renderability --------------------------------------------------------

test('a pre-v1.0 record is caught as unrenderable rather than crashing a screen', () => {
  // The exact shape that used to kill the advisory screen: valid when stored,
  // missing blocks the current renderer walks without checking.
  const old = {
    advisory_id: 'old-1',
    schema_version: '0.9',
    generated_at_utc: '2026-09-01T10:00:00Z',
    water: { cwsi: null },
    inputs: [],
  };
  assert.ok(!isRenderable(old));
  const missing = missingBlocks(old);
  assert.ok(missing.includes('thermal'));
  assert.ok(missing.includes('irrigation'));
  assert.ok(missing.includes('crop_health'));
});

test('a non-object is unrenderable rather than throwing', () => {
  assert.ok(!isRenderable(null));
  assert.ok(!isRenderable('a string'));
  assert.equal(validateAdvisory(null).ok, false);
});
