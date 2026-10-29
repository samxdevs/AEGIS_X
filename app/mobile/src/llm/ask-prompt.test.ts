/**
 * The Ask tab's prompt: what the model is given, and that the guard still
 * holds when the answer is about several scans and a conversation.
 *
 *   npm test
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import type { Advisory } from '../schema/advisory.ts';
import { voiceLanguage } from '../voice/sarvam.ts';
import { ASK_SYSTEM_PROMPT, buildAskMessage } from './ask-prompt.ts';
import { checkFigures } from './guard.ts';
import { FIELD_GUIDE } from './prompt.ts';

const FIXTURE_DIR = fileURLToPath(new URL('../../fixtures/', import.meta.url).href);
const fixture = (name: string): Advisory =>
  JSON.parse(readFileSync(`${FIXTURE_DIR}${name}.json`, 'utf8')) as Advisory;

const healthy = fixture('advisory-healthy');
const recalled = fixture('advisory-recalled-dose');

test('the Ask prompt carries the same field guide as the explanation', () => {
  assert.ok(ASK_SYSTEM_PROMPT.includes(FIELD_GUIDE));
});

test('the prompt says a number word is still a number', () => {
  // The guard reads digits in every Indian script, but not words. This
  // sentence is what covers the gap, so its removal should fail a test.
  assert.match(ASK_SYSTEM_PROMPT, /in digits OR in\s+words/);
});

test('the message names the language, every scan, the history and the question', () => {
  const msg = buildAskMessage({
    question: 'என் பயிர் எப்படி இருக்கிறது?',
    language: voiceLanguage('ta-IN'),
    history: [
      { role: 'farmer', text: 'first question' },
      { role: 'assistant', text: 'first answer' },
    ],
    advisories: [healthy, recalled],
  });
  assert.ok(msg.startsWith('Reply in Tamil (தமிழ்).'));
  assert.ok(msg.includes(healthy.advisory_id));
  assert.ok(msg.includes(recalled.advisory_id));
  assert.ok(msg.includes('Farmer: first question'));
  assert.ok(msg.includes('You: first answer'));
  assert.ok(msg.trimEnd().endsWith('என் பயிர் எப்படி இருக்கிறது?'));
});

test('with no scans the model is told there is nothing measured', () => {
  const msg = buildAskMessage({ question: 'q', language: voiceLanguage('hi-IN'), history: [], advisories: [] });
  assert.match(msg, /no scans on this phone/);
});

test('only the last few turns are sent', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: 'farmer' as const, text: `turn ${i}` }));
  const msg = buildAskMessage({ question: 'q', language: voiceLanguage('hi-IN'), history, advisories: [] });
  assert.ok(!msg.includes('turn 13\n'));
  assert.ok(msg.includes('turn 19'));
});

test('an answer may repeat what the farmer said, but not invent a dose', () => {
  const source = { advisories: [healthy], farmerSaid: ['मेरे पास 7 बीघा खेत है'] };
  assert.equal(checkFigures('आपके 7 बीघा खेत में फ़सल ठीक दिख रही है।', source).ok, true);
  assert.equal(checkFigures('हर लीटर में ९९९९९९ मिली मिलाएँ।', source).ok, false);
});
