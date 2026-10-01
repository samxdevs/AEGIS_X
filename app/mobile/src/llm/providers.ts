/**
 * The LLM providers the Profile screen can be pointed at.
 *
 * Two wire formats cover all of them. Claude has its own (`anthropic`). Nearly
 * everyone else, OpenAI, Gemini, Groq, xAI, Mistral, DeepSeek, OpenRouter and
 * local servers such as Ollama, speaks the OpenAI chat-completions format
 * (`openai`), differing only in base URL, key and model name. So adding a
 * provider is one entry here, not new code.
 *
 * Model names go stale faster than anything else in this file, which is why
 * each provider has a default but the Profile screen lets the farmer's helper
 * type any model id. The defaults are a starting point, not a promise.
 *
 * Pure module, no React Native imports.
 */

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'xai'
  | 'mistral'
  | 'deepseek'
  | 'openrouter'
  | 'custom';

export type Provider = {
  id: ProviderId;
  name: string;
  /** Which request/response shape to use. */
  format: 'anthropic' | 'openai';
  /** Where requests go. `null` for `custom`, where the user supplies it. */
  baseUrl: string | null;
  defaultModel: string;
  /** What a key for this provider looks like, shown as the input placeholder. */
  keyHint: string;
  /** Where to get a key, shown as plain text (never opened by the app). */
  keyPage: string;
  /**
   * OpenAI's newer models reject `max_tokens` and want `max_completion_tokens`;
   * everyone else still takes `max_tokens`.
   */
  maxTokensParam: 'max_tokens' | 'max_completion_tokens';
  /** A key is optional for local servers. */
  keyOptional?: boolean;
};

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Claude',
    format: 'anthropic',
    baseUrl: null,
    defaultModel: 'claude-opus-5',
    keyHint: 'sk-ant-...',
    keyPage: 'console.anthropic.com',
    maxTokensParam: 'max_tokens',
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    format: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    keyHint: 'sk-...',
    keyPage: 'platform.openai.com',
    maxTokensParam: 'max_completion_tokens',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    format: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    keyHint: 'AIza...',
    keyPage: 'aistudio.google.com',
    maxTokensParam: 'max_tokens',
  },
  {
    id: 'groq',
    name: 'Groq',
    format: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    keyHint: 'gsk_...',
    keyPage: 'console.groq.com',
    maxTokensParam: 'max_tokens',
  },
  {
    id: 'xai',
    name: 'Grok',
    format: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4',
    keyHint: 'xai-...',
    keyPage: 'console.x.ai',
    maxTokensParam: 'max_tokens',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    format: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    keyHint: 'API key',
    keyPage: 'console.mistral.ai',
    maxTokensParam: 'max_tokens',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    format: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    keyHint: 'sk-...',
    keyPage: 'platform.deepseek.com',
    maxTokensParam: 'max_tokens',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    format: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4.5',
    keyHint: 'sk-or-...',
    keyPage: 'openrouter.ai',
    maxTokensParam: 'max_tokens',
  },
  {
    id: 'custom',
    name: 'Other',
    format: 'openai',
    baseUrl: null,
    defaultModel: '',
    keyHint: 'API key',
    keyPage: '',
    maxTokensParam: 'max_tokens',
    keyOptional: true,
  },
];

export function getProvider(id: ProviderId): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export function isProviderId(value: unknown): value is ProviderId {
  return PROVIDERS.some((p) => p.id === value);
}

/** What one provider needs to be called. */
export type ProviderSettings = {
  apiKey: string;
  /** Empty means "use the provider's default". */
  model: string;
  /** Only used by `custom`. */
  baseUrl: string;
};

export const EMPTY_SETTINGS: ProviderSettings = { apiKey: '', model: '', baseUrl: '' };

/** The model that will actually be sent. */
export function effectiveModel(p: Provider, s: ProviderSettings): string {
  return s.model.trim() || p.defaultModel;
}

/** The base URL that will actually be used, without a trailing slash. */
export function effectiveBaseUrl(p: Provider, s: ProviderSettings): string {
  return (p.baseUrl ?? s.baseUrl).trim().replace(/\/+$/, '');
}

/**
 * Whether these settings are enough to make a call. A key is required except
 * for local servers, and `custom` also needs an address and a model, because
 * there is nothing to default them to.
 */
export function isUsable(p: Provider, s: ProviderSettings): boolean {
  if (!p.keyOptional && !s.apiKey.trim()) return false;
  if (p.format === 'openai') {
    if (!effectiveBaseUrl(p, s)) return false;
    if (!effectiveModel(p, s)) return false;
  }
  return true;
}

/** Everything the Profile screen saves: the chosen provider, and each one's details. */
export type LlmSettings = {
  /** The provider explanations are generated with; `null` until one is saved. */
  active: ProviderId | null;
  /** Kept per provider, so switching does not lose the others' keys. */
  providers: Partial<Record<ProviderId, ProviderSettings>>;
};

export const NO_SETTINGS: LlmSettings = { active: null, providers: {} };

/** Reads the saved JSON defensively: anything unexpected is dropped, not thrown. */
export function parseSettings(json: string | null): LlmSettings {
  if (!json) return NO_SETTINGS;
  try {
    const raw = JSON.parse(json) as { active?: unknown; providers?: Record<string, unknown> };
    const providers: LlmSettings['providers'] = {};
    for (const p of PROVIDERS) {
      const entry = raw.providers?.[p.id] as Partial<ProviderSettings> | undefined;
      if (entry && typeof entry === 'object') {
        providers[p.id] = {
          apiKey: typeof entry.apiKey === 'string' ? entry.apiKey : '',
          model: typeof entry.model === 'string' ? entry.model : '',
          baseUrl: typeof entry.baseUrl === 'string' ? entry.baseUrl : '',
        };
      }
    }
    return { active: isProviderId(raw.active) ? raw.active : null, providers };
  } catch {
    return NO_SETTINGS;
  }
}

/** `sk-ant-api03-abcdef...wxyz` becomes `sk-a...wxyz`; short keys are fully hidden. */
export function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return k ? '••••' : '';
  return `${k.slice(0, 4)}...${k.slice(-4)}`;
}
