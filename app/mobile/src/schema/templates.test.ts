/**
 * The offline localisation table, tested the way the validator is: not just
 * that it renders, but that the safety properties it is responsible for cannot
 * be edited away by accident.
 *
 *   npm test
 *
 * Three of these are load-bearing rather than decorative.
 *
 * `RECALLED_UNVERIFIED` must carry a mandatory caution in every language.
 * TEMPLATE_ID_REGISTRY §1.2 states it as a requirement — "MUST NOT be displayed
 * without a prominent caution badge" — and a requirement nobody tests is a
 * comment.
 *
 * An unrecognised verification status must fail *cautious*. The enum is frozen
 * at four values today; the moment a fifth ships from the pod, the app must
 * treat it as unverified rather than falling through to a neutral badge that
 * makes an unchecked dose look checked.
 *
 * A null parameter must never reach a farmer as the word "null". Registry §1.1
 * is explicit that `cwsi` and `soil_moisture_pct` are null on the hardware as it
 * stands, so this is the common path, not the edge case.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  TEMPLATES,
  TEMPLATE_IDS,
  interpolate,
  isKnownTemplate,
  presentVerification,
  renderAction,
} from './templates.ts';
import type { Action } from './advisory.ts';

const FIXTURE_DIR = fileURLToPath(new URL('../../fixtures/', import.meta.url).href);
const fixtures = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(FIXTURE_DIR + f, 'utf8')));

// ---- Completeness ---------------------------------------------------------

test('the registry holds exactly the 21 frozen template ids', () => {
  assert.equal(TEMPLATE_IDS.length, 21);
  assert.equal(new Set(TEMPLATE_IDS).size, 21, 'a template id is duplicated');
  assert.equal(Object.keys(TEMPLATES).length, 21);
});

test('every template carries both languages, non-empty', () => {
  for (const id of TEMPLATE_IDS) {
    const t = TEMPLATES[id];
    assert.ok(t, `${id} is missing from the table`);
    for (const lang of ['en', 'hi'] as const) {
      assert.ok(t[lang].action.trim().length > 0, `${id}.${lang}.action is empty`);
      assert.ok(t[lang].rationale.trim().length > 0, `${id}.${lang}.rationale is empty`);
    }
  }
});

test('the Hindi strings are actually in Devanagari', () => {
  // A copy-paste slip that left English in the Hindi column would otherwise
  // pass every other test in this file and reach a farmer.
  const devanagari = /[ऀ-ॿ]/;
  for (const id of TEMPLATE_IDS) {
    assert.match(TEMPLATES[id].hi.action, devanagari, `${id} Hindi action is not in Devanagari`);
    assert.match(
      TEMPLATES[id].hi.rationale,
      devanagari,
      `${id} Hindi rationale is not in Devanagari`,
    );
  }
});

test('every placeholder in a template has a match in the other language', () => {
  // A dose that appears in English and is silently dropped from Hindi is the
  // exact class of bug this table exists to make impossible.
  const params = (s: string) => new Set((s.match(/\{(\w+)\}/g) ?? []).sort());
  for (const id of TEMPLATE_IDS) {
    const t = TEMPLATES[id];
    assert.deepEqual(
      params(t.en.action),
      params(t.hi.action),
      `${id} action placeholders differ between languages`,
    );
    assert.deepEqual(
      params(t.en.rationale),
      params(t.hi.rationale),
      `${id} rationale placeholders differ between languages`,
    );
  }
});

test('every template id used by a fixture is in the registry', () => {
  for (const advisory of fixtures) {
    for (const action of advisory.actions ?? []) {
      assert.ok(
        isKnownTemplate(action.template_id),
        `${advisory.advisory_id} uses unknown template ${action.template_id}`,
      );
    }
  }
});

test('the registry agrees with the fixtures about verification status', () => {
  for (const advisory of fixtures) {
    for (const action of advisory.actions ?? []) {
      const entry = TEMPLATES[action.template_id];
      if (!entry) continue;
      assert.equal(
        action.verification_status,
        entry.verification,
        `${action.template_id} is stamped ${action.verification_status} on the wire but ${entry.verification} in the registry`,
      );
    }
  }
});

// ---- The mandatory caution ------------------------------------------------

test('RECALLED_UNVERIFIED always carries a mandatory caution, in both languages', () => {
  for (const lang of ['en', 'hi'] as const) {
    const p = presentVerification('RECALLED_UNVERIFIED', lang);
    assert.equal(p.mandatory, true, `${lang} caution is not marked mandatory`);
    assert.equal(p.tone, 'bad', `${lang} caution is not rendered as a warning`);
    assert.ok(p.badge.trim().length > 0);
    assert.ok(p.note.trim().length > 0);
  }
  // And the note must actually send them somewhere, not just hedge.
  assert.match(presentVerification('RECALLED_UNVERIFIED', 'en').note, /Krishi Vigyan Kendra/);
  assert.match(presentVerification('RECALLED_UNVERIFIED', 'hi').note, /कृषि विज्ञान केंद्र/);
});

test('UNSOURCED directs the farmer to a person rather than to a chemical', () => {
  const p = presentVerification('UNSOURCED', 'en');
  assert.equal(p.mandatory, true);
  assert.match(p.note, /Krishi Vigyan Kendra|extension officer/);
});

test('WEB_VERIFIED names the authority it was checked against', () => {
  assert.match(presentVerification('WEB_VERIFIED', 'en').badge, /CIB&RC/);
  assert.match(presentVerification('WEB_VERIFIED', 'hi').badge, /CIB&RC/);
});

/**
 * The enum is frozen at four today. When a fifth ships, the app must not let it
 * through looking safer than the ones it knows about.
 */
test('an unrecognised verification status fails cautious', () => {
  for (const lang of ['en', 'hi'] as const) {
    const p = presentVerification('SOMETHING_NEW', lang);
    assert.equal(p.mandatory, true, `${lang} let an unknown status through as optional`);
    assert.equal(p.tone, 'bad', `${lang} rendered an unknown status neutrally`);
  }
});

// ---- Interpolation and null safety ----------------------------------------

test('a null parameter renders as words, never as "null"', () => {
  const out = interpolate('Stress {cwsi}, soil {soil_moisture_pct}.', {
    cwsi: null,
    soil_moisture_pct: undefined,
  });
  assert.ok(!/null|undefined/.test(out), `leaked a raw null: ${out}`);
  assert.equal(out, 'Stress not measured, soil not measured.');
});

test('a null parameter renders in the right language', () => {
  const out = interpolate('तनाव {cwsi}।', { cwsi: null }, 'hi');
  assert.equal(out, 'तनाव मापा नहीं गया।');
});

test('a missing parameter key is handled like a null one', () => {
  assert.equal(interpolate('Apply {depth} mm.', {}), 'Apply not measured mm.');
});

test('numbers and zero survive interpolation intact', () => {
  // Zero is a value, not an absence. Collapsing it into "not measured" would be
  // the same fabrication in the other direction.
  assert.equal(interpolate('{n} mm', { n: 0 }), '0 mm');
  assert.equal(interpolate('{n} mm', { n: 5.65 }), '5.65 mm');
});

test('the irrigation template survives the nulls it actually gets', () => {
  // Registry §1.1: cwsi and soil_moisture_pct ARE null on the hardware today.
  const action = {
    rank: 1,
    template_id: 'ACT_IRRIGATE_WATER_DEFICIT',
    action: '',
    rationale: '',
    params: {
      etc_mm_day: 5.65,
      irrigation_depth_mm: 28,
      cwsi: null,
      soil_moisture_pct: null,
      verification_status: 'VERIFIED',
    },
    verification_status: 'VERIFIED',
    confidence: 'medium',
    advisory_only: true,
    generated_by: 'template',
    source: 'derived',
  } as unknown as Action;

  for (const lang of ['en', 'hi'] as const) {
    const r = renderAction(action, lang);
    assert.ok(!/null|undefined|\{/.test(r.action), `${lang} action leaked: ${r.action}`);
    assert.ok(!/null|undefined|\{/.test(r.rationale), `${lang} rationale leaked: ${r.rationale}`);
    assert.ok(r.action.includes('5.65'), `${lang} dropped the water requirement`);
  }
});

// ---- Rendering ------------------------------------------------------------

test('English prefers the pod’s own wording over the table', () => {
  const action = {
    rank: 1,
    template_id: 'ACT_MAINTAIN_ROUTINE',
    action: 'Wording the pod tightened after this app shipped.',
    rationale: 'And its reasoning.',
    params: {},
    verification_status: 'WEB_VERIFIED',
    confidence: 'high',
    advisory_only: true,
    generated_by: 'template',
    source: 'derived',
  } as unknown as Action;

  const r = renderAction(action, 'en');
  assert.equal(r.action, 'Wording the pod tightened after this app shipped.');
  assert.equal(r.localised, true);
});

test('English falls back to the table when the pod sends an empty string', () => {
  const action = {
    rank: 1,
    template_id: 'ACT_MAINTAIN_ROUTINE',
    action: '   ',
    rationale: '',
    params: {},
    verification_status: 'WEB_VERIFIED',
    confidence: 'high',
    advisory_only: true,
    generated_by: 'template',
    source: 'derived',
  } as unknown as Action;

  const r = renderAction(action, 'en');
  assert.ok(r.action.includes('Maintain routine crop management'));
});

test('Hindi renders from the table, not from the wire', () => {
  const action = {
    rank: 1,
    template_id: 'ACT_TREAT_WHEAT_YELLOW_RUST',
    action: 'English from the pod.',
    rationale: 'English reasoning.',
    params: { crop: 'wheat', disease: 'yellow_rust', verification_status: 'WEB_VERIFIED' },
    verification_status: 'WEB_VERIFIED',
    confidence: 'high',
    advisory_only: true,
    generated_by: 'template',
    source: 'derived',
  } as unknown as Action;

  const r = renderAction(action, 'hi');
  assert.ok(r.localised);
  assert.match(r.action, /[ऀ-ॿ]/);
  assert.ok(!r.action.includes('English from the pod'));
  // The dose has to survive the language switch. This is the whole point.
  assert.ok(r.action.includes('200'), 'the Hindi rendering dropped the dose');
});

test('an unknown template id falls back to English and says so', () => {
  const action = {
    rank: 1,
    template_id: 'ACT_SOMETHING_NEW',
    action: 'Do the new thing.',
    rationale: 'Because.',
    params: {},
    verification_status: 'WEB_VERIFIED',
    confidence: 'high',
    advisory_only: true,
    generated_by: 'template',
    source: 'derived',
  } as unknown as Action;

  const r = renderAction(action, 'hi');
  assert.equal(r.localised, false, 'an untranslatable action must admit it');
  assert.equal(r.action, 'Do the new thing.');
});

test('a wire status that disagrees with the registry is reported, not hidden', () => {
  const action = {
    rank: 1,
    template_id: 'ACT_TREAT_SUGARCANE_RED_ROT',
    action: 'x',
    rationale: 'y',
    params: {},
    // The registry says this template is RECALLED_UNVERIFIED.
    verification_status: 'WEB_VERIFIED',
    confidence: 'high',
    advisory_only: true,
    generated_by: 'template',
    source: 'derived',
  } as unknown as Action;

  const r = renderAction(action, 'en');
  assert.equal(r.verificationMismatch, true);
  // The pod is the live authority, so its marking is the one rendered.
  assert.match(r.verification.badge, /CIB&RC/);
});

test('the badge comes from the status, never from the prose', () => {
  // A pod that sends reassuring English with an unverified stamp must still get
  // the caution. This is the failure mode §1.2 is written against.
  const action = {
    rank: 1,
    template_id: 'ACT_TREAT_SUGARCANE_SMUT',
    action: 'Spray the fully approved and verified government-recommended dose.',
    rationale: 'Verified against everything.',
    params: { verification_status: 'RECALLED_UNVERIFIED' },
    verification_status: 'RECALLED_UNVERIFIED',
    confidence: 'high',
    advisory_only: true,
    generated_by: 'template',
    source: 'derived',
  } as unknown as Action;

  for (const lang of ['en', 'hi'] as const) {
    const r = renderAction(action, lang);
    assert.equal(r.verification.mandatory, true);
    assert.equal(r.verification.tone, 'bad');
  }
});
