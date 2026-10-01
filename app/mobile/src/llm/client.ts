/**
 * The call to the language model, and the only file in the app that talks to
 * the internet.
 *
 * This is the fourth tier (F1). Everything about it is additive: the advisory
 * was already pulled, validated, stored and rendered before this file runs, and
 * if it never runs the app is exactly what it was. Nothing in the field path
 * may wait on this, and nothing here may write to the advisory tables.
 *
 * ── Which model, and where the key lives (F3a) ───────────────────────────────
 * The person picks a provider on the Profile screen (Claude, ChatGPT, Gemini,
 * Groq and others, see providers.ts) and pastes their own key. That key lives
 * in the phone's private storage, not in the build, so it cannot be pulled out
 * of the APK. Claude is called through its SDK; every other provider speaks the
 * OpenAI chat-completions format and goes through openai-compat.ts.
 *
 * Build-time config still works as a fallback for when nothing is saved on the
 * phone, and is the older F3a pair:
 *
 *   EXPO_PUBLIC_AEGIS_LLM_PROXY   set  -> requests go to the proxy, no key here
 *   EXPO_PUBLIC_ANTHROPIC_API_KEY set  -> requests go direct, key is in the app
 *
 * `EXPO_PUBLIC_` is Expo's marker for "this is inlined into the bundle", which
 * is a usefully blunt name for the risk. A key saved on the Profile screen wins
 * over both.
 */

import Anthropic, {
  APIConnectionError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from '@anthropic-ai/sdk';

import type { Advisory } from '../schema/advisory.ts';
import { checkFigures } from './guard.ts';
import type { Figure } from './guard.ts';
import { chatCompletion } from './openai-compat.ts';
import type { ChatResult } from './openai-compat.ts';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.ts';
import type { Language } from './prompt.ts';
import { effectiveBaseUrl, effectiveModel, getProvider, isUsable } from './providers.ts';
import type { Provider, ProviderSettings } from './providers.ts';
import { activeProvider } from './settings.ts';

/** Claude's default when nothing else is chosen; runs once per advisory, not per screen. */
export const MODEL = getProvider('anthropic').defaultModel;

const PROXY_URL = process.env.EXPO_PUBLIC_AEGIS_LLM_PROXY;
const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

const TIMEOUT_MS = 60_000;

export type ExplainResult =
  | { status: 'ok'; text: string; model: string }
  /** The guard fired. The text is discarded; the evidence is not. */
  | { status: 'rejected'; offending: Figure[] }
  | { status: 'unconfigured'; reason: string }
  | { status: 'failed'; reason: string };

/** Where a call goes: one of the two wire formats, fully resolved. */
type Endpoint =
  | { format: 'anthropic'; apiKey: string; baseURL?: string; model: string; label: string }
  | {
      format: 'openai';
      apiKey: string;
      baseUrl: string;
      model: string;
      maxTokensParam: Provider['maxTokensParam'];
      label: string;
    };

function toEndpoint(provider: Provider, settings: ProviderSettings): Endpoint | null {
  if (!isUsable(provider, settings)) return null;
  const model = effectiveModel(provider, settings);
  if (provider.format === 'anthropic') {
    return { format: 'anthropic', apiKey: settings.apiKey.trim(), model, label: provider.name };
  }
  return {
    format: 'openai',
    apiKey: settings.apiKey.trim(),
    baseUrl: effectiveBaseUrl(provider, settings),
    model,
    maxTokensParam: provider.maxTokensParam,
    label: provider.name,
  };
}

/** The Profile screen's choice, when it is complete enough to call. */
function savedEndpoint(): Endpoint | null {
  const saved = activeProvider();
  return saved ? toEndpoint(saved.provider, saved.settings) : null;
}

/** Profile choice first, then the build-time proxy or key, else nothing. */
function resolveEndpoint(): Endpoint | null {
  const saved = savedEndpoint();
  if (saved) return saved;
  if (PROXY_URL) {
    return {
      format: 'anthropic',
      apiKey: API_KEY ?? 'proxy',
      baseURL: PROXY_URL,
      model: MODEL,
      label: 'proxy',
    };
  }
  if (API_KEY) return { format: 'anthropic', apiKey: API_KEY, model: MODEL, label: 'Claude' };
  return null;
}

export function isConfigured(): boolean {
  return resolveEndpoint() !== null;
}

/** Which path is live, for the sync screen to report. */
export function configSummary(): string {
  const saved = savedEndpoint();
  if (saved) return `${saved.label}, key saved on this phone`;
  if (PROXY_URL) return `via proxy ${PROXY_URL}`;
  if (API_KEY) return 'direct, key in app bundle';
  return 'not configured';
}

let client: { key: string; sdk: Anthropic } | null = null;

function getClient(ep: Extract<Endpoint, { format: 'anthropic' }>): Anthropic {
  const key = `${ep.baseURL ?? ''}|${ep.apiKey}`;
  if (client?.key === key) return client.sdk;
  const sdk = new Anthropic({
    ...(ep.baseURL ? { baseURL: ep.baseURL, apiKey: ep.apiKey } : { apiKey: ep.apiKey }),
    timeout: TIMEOUT_MS,
    // React Native has no `window.document`, so the SDK's browser check usually
    // does not fire, but on a client device the concern the flag names is real
    // and is exactly F3a. Set deliberately, not to silence a warning.
    dangerouslyAllowBrowser: true,
  });
  client = { key, sdk };
  return sdk;
}

/** One model call, in whichever wire format the endpoint speaks. Never throws. */
async function complete(
  ep: Endpoint,
  system: string,
  user: string,
  maxTokens: number,
): Promise<ChatResult> {
  if (ep.format === 'openai') {
    return chatCompletion({
      baseUrl: ep.baseUrl,
      apiKey: ep.apiKey,
      model: ep.model,
      system,
      user,
      maxTokens,
      maxTokensParam: ep.maxTokensParam,
      timeoutMs: TIMEOUT_MS,
    });
  }

  try {
    const response = await getClient(ep).messages.create({
      model: ep.model,
      max_tokens: maxTokens,
      // Ranking what matters in a degraded advisory is a judgement call, but a
      // small one, and a farmer is waiting on a phone. Medium is the balance.
      output_config: { effort: 'medium' },
      system,
      messages: [{ role: 'user', content: user }],
    });

    // Opus 5 can decline a request outright; that arrives as a 200, so it has
    // to be checked before reading content.
    if (response.stop_reason === 'refusal') return { ok: false, kind: 'refusal' };

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    return text ? { ok: true, text } : { ok: false, kind: 'empty' };
  } catch (err) {
    if (err instanceof AuthenticationError) return { ok: false, kind: 'auth', status: err.status };
    if (err instanceof RateLimitError) return { ok: false, kind: 'rate_limit', status: 429 };
    if (err instanceof APIConnectionError) return { ok: false, kind: 'network' };
    if (err instanceof APIError) {
      return { ok: false, kind: 'http', status: err.status, detail: err.message.slice(0, 200) };
    }
    return { ok: false, kind: 'http', detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Explains one advisory, in one language.
 *
 * Errors are returned rather than thrown: having no internet is the ordinary
 * state of this app, not an exception, and the UI renders it as one of several
 * normal states.
 */
export async function explainAdvisory(
  advisory: Advisory,
  language: Language,
): Promise<ExplainResult> {
  const ep = resolveEndpoint();
  if (!ep) {
    return {
      status: 'unconfigured',
      reason: 'No AI provider is set up. Add an API key on the Profile screen.',
    };
  }

  const result = await complete(
    ep,
    SYSTEM_PROMPT,
    buildUserMessage(advisory, language),
    ep.format === 'anthropic' ? 16000 : 4000,
  );
  if (!result.ok) return { status: 'failed', reason: describeFailure(result, ep.label) };

  // F2, mechanically. Anything the model invented dies here rather than on a
  // farmer's screen.
  const guard = checkFigures(result.text, advisory);
  if (!guard.ok) return { status: 'rejected', offending: guard.offending };

  return { status: 'ok', text: result.text, model: ep.model };
}

export type TestResult = { ok: true; model: string } | { ok: false; reason: string };

/**
 * Checks a key before it is trusted: sends a one-line prompt with the details
 * currently typed on the Profile screen, saved or not. A key that authenticates
 * but gets an empty reply is a pass, because what is being tested is the key,
 * the address and the model name, not the model's manners.
 */
export async function testConnection(
  provider: Provider,
  settings: ProviderSettings,
): Promise<TestResult> {
  const ep = toEndpoint(provider, settings);
  if (!ep) return { ok: false, reason: 'Fill in the missing details first.' };
  const result = await complete(ep, 'Reply with one word.', 'Say OK.', 1024);
  if (result.ok || result.kind === 'empty' || result.kind === 'refusal') {
    return { ok: true, model: ep.model };
  }
  return { ok: false, reason: describeFailure(result, ep.label) };
}

/**
 * The distinction that matters is between a failure worth retrying (no signal,
 * rate limit, a 5xx) and one that will fail identically forever (a bad key).
 * Collapsing them into one message would leave a farmer tapping "Try again" at
 * a problem only a developer can fix.
 */
function describeFailure(f: Extract<ChatResult, { ok: false }>, label: string): string {
  switch (f.kind) {
    case 'auth':
      return `${label} rejected the API key. Check the key on the Profile screen.`;
    case 'rate_limit':
      return 'Rate limited. Wait a moment and try again.';
    case 'network':
      return (
        'Could not reach the internet. This part of AEGIS needs a connection. ' +
        'The advisory above does not, and is already complete without it.'
      );
    case 'timeout':
      return `${label} took too long to answer. Try again.`;
    case 'refusal':
      return 'The model declined to answer for this advisory.';
    case 'empty':
      return 'The model returned an empty response.';
    case 'http': {
      const base = `${label} returned ${f.status ?? 'an error'}.`;
      // A 404 or 400 is almost always a model name the provider does not have.
      const hint =
        f.status === 404 || f.status === 400
          ? ' Check the model name on the Profile screen.'
          : ' Try again later.';
      return f.detail ? `${base} ${f.detail}${hint}` : `${base}${hint}`;
    }
  }
}
