/**
 * The provider catalog, the saved-settings parser and the OpenAI-format client.
 * No network: `fetch` is replaced by a stub that records what it was sent.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chatCompletion, readCompletion } from './openai-compat.ts';
import {
  EMPTY_SETTINGS,
  PROVIDERS,
  effectiveBaseUrl,
  effectiveModel,
  getProvider,
  isUsable,
  maskKey,
  parseSettings,
} from './providers.ts';

test('every provider has a unique id and, unless custom, a default model', () => {
  const ids = PROVIDERS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of PROVIDERS) {
    if (p.id !== 'custom') assert.ok(p.defaultModel, `${p.id} has no default model`);
  }
});

test('a key is required, except for a local server', () => {
  const openai = getProvider('openai');
  assert.equal(isUsable(openai, EMPTY_SETTINGS), false);
  assert.equal(isUsable(openai, { ...EMPTY_SETTINGS, apiKey: '  sk-x  ' }), true);

  const custom = getProvider('custom');
  const local = { apiKey: '', model: 'llama3', baseUrl: 'http://192.168.1.5:11434/v1' };
  assert.equal(isUsable(custom, local), true);
  // No address, or no model: there is nothing to default them to.
  assert.equal(isUsable(custom, { ...local, baseUrl: '' }), false);
  assert.equal(isUsable(custom, { ...local, model: '' }), false);
});

test('model and base URL fall back to the provider defaults and are tidied', () => {
  const groq = getProvider('groq');
  assert.equal(effectiveModel(groq, EMPTY_SETTINGS), groq.defaultModel);
  assert.equal(effectiveModel(groq, { ...EMPTY_SETTINGS, model: ' my-model ' }), 'my-model');

  const custom = getProvider('custom');
  assert.equal(
    effectiveBaseUrl(custom, { ...EMPTY_SETTINGS, baseUrl: ' http://x.test/v1/// ' }),
    'http://x.test/v1',
  );
  // A built-in provider ignores any stray address.
  assert.equal(effectiveBaseUrl(groq, { ...EMPTY_SETTINGS, baseUrl: 'http://evil.test' }), groq.baseUrl);
});

test('a saved key is shown only as its ends', () => {
  assert.equal(maskKey('sk-ant-api03-abcdefghijklmnop'), 'sk-a...mnop');
  assert.equal(maskKey('short'), '••••');
  assert.equal(maskKey(''), '');
});

test('parseSettings survives missing, broken and hostile input', () => {
  assert.deepEqual(parseSettings(null).providers, {});
  assert.equal(parseSettings('not json').active, null);
  assert.equal(parseSettings('{"active":"nope"}').active, null);

  const parsed = parseSettings(
    JSON.stringify({
      active: 'gemini',
      providers: {
        gemini: { apiKey: 'AIza1', model: 5, baseUrl: null },
        unknown: { apiKey: 'x' },
      },
    }),
  );
  assert.equal(parsed.active, 'gemini');
  assert.deepEqual(parsed.providers.gemini, { apiKey: 'AIza1', model: '', baseUrl: '' });
  assert.equal('unknown' in parsed.providers, false);
});

test('readCompletion reads a string, a list of parts, and refuses to invent text', () => {
  assert.deepEqual(readCompletion({ choices: [{ message: { content: ' hi ' } }] }), { ok: true, text: 'hi' });
  assert.deepEqual(
    readCompletion({ choices: [{ message: { content: [{ text: 'a' }, { text: 'b' }] } }] }),
    { ok: true, text: 'ab' },
  );
  assert.deepEqual(readCompletion({ choices: [] }), { ok: false, kind: 'empty' });
  assert.deepEqual(readCompletion({ choices: [{ message: { content: '  ' } }] }), { ok: false, kind: 'empty' });
  assert.deepEqual(
    readCompletion({ choices: [{ finish_reason: 'content_filter', message: { content: 'x' } }] }),
    { ok: false, kind: 'refusal' },
  );
});

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

function stubFetch(status: number, json: unknown, sent: Sent[] = []): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    sent.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string),
    });
    return new Response(JSON.stringify(json), { status });
  }) as unknown as typeof fetch;
}

const base = {
  baseUrl: 'https://api.example.test/v1',
  apiKey: 'secret',
  model: 'm1',
  system: 'sys',
  user: 'usr',
  maxTokens: 100,
  maxTokensParam: 'max_tokens' as const,
  timeoutMs: 1000,
};

test('chatCompletion sends the key as a bearer token and the right token parameter', async () => {
  const sent: Sent[] = [];
  const ok = await chatCompletion({
    ...base,
    fetchImpl: stubFetch(200, { choices: [{ message: { content: 'done' } }] }, sent),
  });
  assert.deepEqual(ok, { ok: true, text: 'done' });
  assert.equal(sent[0].url, 'https://api.example.test/v1/chat/completions');
  assert.equal(sent[0].headers.Authorization, 'Bearer secret');
  assert.equal(sent[0].body.max_tokens, 100);
  assert.equal('max_completion_tokens' in sent[0].body, false);

  await chatCompletion({
    ...base,
    maxTokensParam: 'max_completion_tokens',
    fetchImpl: stubFetch(200, { choices: [{ message: { content: 'x' } }] }, sent),
  });
  assert.equal(sent[1].body.max_completion_tokens, 100);
  assert.equal('max_tokens' in sent[1].body, false);
});

test('chatCompletion sends no Authorization header when there is no key', async () => {
  const sent: Sent[] = [];
  await chatCompletion({
    ...base,
    apiKey: '',
    fetchImpl: stubFetch(200, { choices: [{ message: { content: 'x' } }] }, sent),
  });
  assert.equal('Authorization' in sent[0].headers, false);
});

test('chatCompletion tells a bad key from a rate limit from a wrong model', async () => {
  const bad = await chatCompletion({ ...base, fetchImpl: stubFetch(401, { error: { message: 'bad key' } }) });
  assert.deepEqual(bad, { ok: false, kind: 'auth', status: 401, detail: 'bad key' });

  const limited = await chatCompletion({ ...base, fetchImpl: stubFetch(429, {}) });
  assert.equal(limited.ok === false && limited.kind, 'rate_limit');

  const missing = await chatCompletion({
    ...base,
    fetchImpl: stubFetch(404, { error: { message: 'model not found' } }),
  });
  assert.deepEqual(missing, { ok: false, kind: 'http', status: 404, detail: 'model not found' });
});

test('chatCompletion reports no signal as a network failure, not a thrown error', async () => {
  const offline = (async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  assert.deepEqual(await chatCompletion({ ...base, fetchImpl: offline }), { ok: false, kind: 'network' });
});
