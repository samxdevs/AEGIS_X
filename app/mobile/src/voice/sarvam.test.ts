/**
 * The Sarvam calls without a network: what goes out, what comes back, and that
 * every failure arrives as a kind the Ask tab can explain.
 *
 *   npm test
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canSpeak, scriptLanguage, synthesize, transcribe, uploadType, voiceLanguage, VOICE_LANGUAGES } from './sarvam.ts';

type Sent = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown, sent: Sent[] = []): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

const audio = new Blob([new Uint8Array([0, 1, 2])], { type: 'audio/m4a' });

// ---- transcribe -----------------------------------------------------------

test('transcribe asks Sarvam to detect the language, and returns what it heard', async () => {
  const sent: Sent[] = [];
  const result = await transcribe({
    apiKey: 'k',
    audio,
    fetchImpl: fakeFetch(200, { transcript: ' मेरी फ़सल कैसी है? ', language_code: 'hi-IN' }, sent),
  });
  assert.deepEqual(result, { ok: true, transcript: 'मेरी फ़सल कैसी है?', language: 'hi-IN' });
  assert.equal(sent[0].url, 'https://api.sarvam.ai/speech-to-text');
  assert.equal((sent[0].init.headers as Record<string, string>)['api-subscription-key'], 'k');
  const form = sent[0].init.body as FormData;
  assert.equal(form.get('language_code'), 'unknown');
  assert.equal(form.get('model'), 'saaras:v3');
});

test('silence is "empty", not a question', async () => {
  const result = await transcribe({ apiKey: 'k', audio, fetchImpl: fakeFetch(200, { transcript: '   ' }) });
  assert.deepEqual(result, { ok: false, kind: 'empty' });
});

test('a bad key is auth, a full quota is rate_limit: they need different fixes', async () => {
  const bad = await transcribe({ apiKey: 'k', audio, fetchImpl: fakeFetch(403, { error: { message: 'Invalid key' } }) });
  assert.deepEqual(bad, { ok: false, kind: 'auth', status: 403, detail: 'Invalid key' });
  const full = await transcribe({ apiKey: 'k', audio, fetchImpl: fakeFetch(429, {}) });
  assert.equal(full.ok ? null : full.kind, 'rate_limit');
});

test('no signal is network, the ordinary state of this app', async () => {
  const offline = (async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  // The underlying message is kept: from here, a malformed request also looks
  // like "network", and the message is how a developer tells them apart.
  assert.deepEqual(await transcribe({ apiKey: 'k', audio, fetchImpl: offline }), {
    ok: false,
    kind: 'network',
    detail: 'Network request failed',
  });
});

// ---- synthesize -----------------------------------------------------------

test('synthesize sends the answer in its language and returns the audio', async () => {
  const sent: Sent[] = [];
  const result = await synthesize({
    apiKey: 'k',
    text: 'फ़सल ठीक है।',
    language: 'hi-IN',
    fetchImpl: fakeFetch(200, { audios: ['UklGRg=='] }, sent),
  });
  assert.deepEqual(result, { ok: true, mp3Base64: 'UklGRg==' });
  const body = JSON.parse(sent[0].init.body as string) as Record<string, string | number>;
  assert.equal(body.language_code, 'hi-IN');
  assert.equal(body.model, 'bulbul:v3');
  assert.equal(body.output_audio_codec, 'mp3');
});

test('a language with no Sarvam voice is refused before any request is made', async () => {
  const sent: Sent[] = [];
  const result = await synthesize({ apiKey: 'k', text: 'x', language: 'as-IN', fetchImpl: fakeFetch(200, {}, sent) });
  assert.equal(result.ok, false);
  assert.equal(sent.length, 0);
});

// ---- languages ------------------------------------------------------------

test('22 Indian languages plus English are recognised, 11 are spoken', () => {
  assert.equal(VOICE_LANGUAGES.length, 23);
  assert.equal(VOICE_LANGUAGES.filter((l) => l.speaks).length, 11);
  assert.equal(canSpeak('ta-IN'), true);
  assert.equal(canSpeak('sat-IN'), false);
  assert.equal(canSpeak('xx-IN'), false);
});

test('an unknown code falls back to Hindi rather than to nothing', () => {
  assert.equal(voiceLanguage('xx-IN').code, 'hi-IN');
  assert.equal(voiceLanguage(null).code, 'hi-IN');
});

test('a typed question takes its language from its script', () => {
  assert.equal(scriptLanguage('என் பயிர் எப்படி இருக்கிறது?'), 'ta-IN');
  assert.equal(scriptLanguage('నా పంట ఎలా ఉంది?'), 'te-IN');
  assert.equal(scriptLanguage('আমার ফসল কেমন আছে?'), 'bn-IN');
  assert.equal(scriptLanguage('How is my crop?'), 'en-IN');
  assert.equal(scriptLanguage('मेरी फ़सल कैसी है?'), 'hi-IN');
});

test('Devanagari keeps a Marathi conversation in Marathi', () => {
  // Hindi and Marathi share a script; the conversation decides, not a guess.
  assert.equal(scriptLanguage('माझे पीक कसे आहे?', 'mr-IN'), 'mr-IN');
  assert.equal(scriptLanguage('माझे पीक कसे आहे?', 'ta-IN'), 'hi-IN');
});

test('uploads are labelled with a type Sarvam accepts, not the phone own', () => {
  // iOS reports WAV as audio/vnd.wave, which Sarvam rejects with a 400.
  assert.equal(uploadType('recording-123.wav'), 'audio/wav');
  assert.equal(uploadType('question.M4A'), 'audio/mp4');
  assert.equal(uploadType('mystery.caf'), 'application/octet-stream');
});
