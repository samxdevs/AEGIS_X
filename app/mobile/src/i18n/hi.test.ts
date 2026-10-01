/**
 * The Hindi dictionary against the source.
 *
 * Every string the app shows through `tr()` must have Hindi, keep the same
 * `{placeholders}` (a dropped one would print a raw "{n}" or lose a number),
 * and contain no em dashes. Entries nothing uses are flagged too, so the file
 * cannot fill up with dead text.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HI } from './hi.ts';
import { placeholders, translatableStrings } from './strings.ts';
import { setCurrentLanguage, tr } from './tr.ts';

const MOBILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const used = translatableStrings(MOBILE);

test('every on-screen English string has Hindi', () => {
  const missing = [...used.entries()].filter(([s]) => !(s in HI)).map(([s, f]) => `${f}: ${s}`);
  assert.deepEqual(missing, [], `untranslated:\n${missing.join('\n')}`);
});

test('Hindi keeps every placeholder of its English', () => {
  const wrong = Object.entries(HI)
    .filter(([en, hi]) => placeholders(en).join() !== placeholders(hi).join())
    .map(([en]) => en);
  assert.deepEqual(wrong, []);
});

test('no Hindi entry is left over from text the app no longer shows', () => {
  const unused = Object.keys(HI).filter((k) => !used.has(k));
  assert.deepEqual(unused, []);
});

test('no em dashes in any English or Hindi string', () => {
  const dashed = [...used.keys(), ...Object.values(HI)].filter((s) => s.includes('—'));
  assert.deepEqual(dashed, []);
});

test('tr switches language and fills placeholders after the lookup', () => {
  setCurrentLanguage('en');
  assert.equal(tr('{n} spots', { n: 3 }), '3 spots');
  setCurrentLanguage('hi');
  assert.equal(tr('{n} spots', { n: 3 }), '3 जगहें');
  // An unknown string falls back to its English rather than to nothing.
  assert.equal(tr('Not a real key {x}', { x: 1 }), 'Not a real key 1');
  setCurrentLanguage('en');
});
