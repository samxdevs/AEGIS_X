/**
 * One chat-completions call, in the OpenAI wire format.
 *
 * Used for every provider that is not Claude. It is plain `fetch` rather than
 * the OpenAI SDK on purpose: the SDK would pin this to one vendor's quirks and
 * add weight, when the request is a single JSON POST. `fetch` is injectable so
 * the tests can run without a network.
 *
 * Failures come back as a typed `kind` rather than a thrown error, so the
 * caller can tell a bad key (will fail forever) from no signal (worth a retry).
 *
 * Pure module, no React Native imports.
 */

export type ChatFailureKind = 'auth' | 'rate_limit' | 'network' | 'timeout' | 'http' | 'empty' | 'refusal';

export type ChatResult =
  | { ok: true; text: string }
  | { ok: false; kind: ChatFailureKind; status?: number; detail?: string };

export type ChatRequest = {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  maxTokensParam: 'max_tokens' | 'max_completion_tokens';
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

export async function chatCompletion(req: ChatRequest): Promise<ChatResult> {
  const doFetch = req.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);

  let response: Response;
  try {
    response = await doFetch(`${req.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Local servers (Ollama and friends) take no key at all.
        ...(req.apiKey ? { Authorization: `Bearer ${req.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: req.model,
        [req.maxTokensParam]: req.maxTokens,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { ok: false, kind: aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await errorDetail(response);
    if (response.status === 401 || response.status === 403) {
      return { ok: false, kind: 'auth', status: response.status, detail };
    }
    if (response.status === 429) {
      return { ok: false, kind: 'rate_limit', status: 429, detail };
    }
    return { ok: false, kind: 'http', status: response.status, detail };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, kind: 'empty' };
  }
  return readCompletion(body);
}

/** Pulls the reply text out of a chat-completions body. Exported for tests. */
export function readCompletion(body: unknown): ChatResult {
  const choice = (body as { choices?: unknown[] } | null)?.choices?.[0] as
    | { finish_reason?: string; message?: { content?: unknown; refusal?: unknown } }
    | undefined;
  if (!choice) return { ok: false, kind: 'empty' };

  if (choice.finish_reason === 'content_filter' || choice.message?.refusal) {
    return { ok: false, kind: 'refusal' };
  }

  const content = choice.message?.content;
  // Some providers return the content as a list of parts rather than a string.
  const text = Array.isArray(content)
    ? content
        .map((part) => (part && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : ''))
        .join('')
    : typeof content === 'string'
      ? content
      : '';

  const trimmed = text.trim();
  return trimmed ? { ok: true, text: trimmed } : { ok: false, kind: 'empty' };
}

/** The provider's own explanation, when it sent one, kept short for the screen. */
async function errorDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } | string; message?: unknown };
    const raw =
      typeof body.error === 'string'
        ? body.error
        : typeof body.error?.message === 'string'
          ? body.error.message
          : typeof body.message === 'string'
            ? body.message
            : undefined;
    return raw ? raw.slice(0, 200) : undefined;
  } catch {
    return undefined;
  }
}
