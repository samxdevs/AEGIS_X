/**
 * The Ask tab's ears and voice: Sarvam speech-to-text and text-to-speech.
 *
 * A farmer should be able to press one button and speak in the language they
 * think in, without first finding it in a list. So recognition is always run
 * with `language_code: unknown` and Sarvam names the language back; the answer
 * is then written and spoken in that same language.
 *
 * Coverage is not symmetric, and the screen has to be honest about it.
 * Recognition covers 22 Indian languages plus English; Sarvam's voices cover
 * only 11 of those. For the rest the answer is shown as text and the play
 * button is not offered, rather than reading it out in the wrong language.
 *
 * Plain `fetch`, injectable, like openai-compat.ts: the tests run with no
 * network, and failures come back as a typed kind rather than a throw, so the
 * screen can tell "no signal" (try again) from "bad key" (go to Profile).
 *
 * Pure module, no React Native imports.
 */

import type { ChatFailureKind } from '../llm/openai-compat.ts';

const BASE = 'https://api.sarvam.ai';

/** Verified with tools/sarvam-first-call.mjs before the app relied on it. */
export const STT_MODEL = 'saaras:v3';
export const TTS_MODEL = 'bulbul:v3';

/** The REST endpoint is for clips under thirty seconds; the recorder stops before that. */
export const MAX_RECORDING_MS = 25_000;

/** Bulbul v3's per-request limit. An answer longer than this is not one a farmer will sit through. */
const TTS_MAX_CHARS = 2500;

const TIMEOUT_MS = 45_000;

export type VoiceLanguage = {
  /** Sarvam's BCP-47 code, e.g. `hi-IN`. */
  code: string;
  /** For the model's instructions. */
  english: string;
  /** For the farmer's screen. */
  native: string;
  /** Whether Sarvam has a voice for it. */
  speaks: boolean;
};

export const VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: 'hi-IN', english: 'Hindi', native: 'हिंदी', speaks: true },
  { code: 'bn-IN', english: 'Bengali', native: 'বাংলা', speaks: true },
  { code: 'mr-IN', english: 'Marathi', native: 'मराठी', speaks: true },
  { code: 'te-IN', english: 'Telugu', native: 'తెలుగు', speaks: true },
  { code: 'ta-IN', english: 'Tamil', native: 'தமிழ்', speaks: true },
  { code: 'gu-IN', english: 'Gujarati', native: 'ગુજરાતી', speaks: true },
  { code: 'kn-IN', english: 'Kannada', native: 'ಕನ್ನಡ', speaks: true },
  { code: 'ml-IN', english: 'Malayalam', native: 'മലയാളം', speaks: true },
  { code: 'od-IN', english: 'Odia', native: 'ଓଡ଼ିଆ', speaks: true },
  { code: 'pa-IN', english: 'Punjabi', native: 'ਪੰਜਾਬੀ', speaks: true },
  { code: 'en-IN', english: 'English', native: 'English', speaks: true },
  { code: 'as-IN', english: 'Assamese', native: 'অসমীয়া', speaks: false },
  { code: 'ur-IN', english: 'Urdu', native: 'اردو', speaks: false },
  { code: 'ne-IN', english: 'Nepali', native: 'नेपाली', speaks: false },
  { code: 'kok-IN', english: 'Konkani', native: 'कोंकणी', speaks: false },
  { code: 'ks-IN', english: 'Kashmiri', native: 'کٲشُر', speaks: false },
  { code: 'sd-IN', english: 'Sindhi', native: 'سنڌي', speaks: false },
  { code: 'sa-IN', english: 'Sanskrit', native: 'संस्कृतम्', speaks: false },
  { code: 'sat-IN', english: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ', speaks: false },
  { code: 'mni-IN', english: 'Manipuri', native: 'ꯃꯩꯇꯩꯂꯣꯟ', speaks: false },
  { code: 'brx-IN', english: 'Bodo', native: 'बड़ो', speaks: false },
  { code: 'mai-IN', english: 'Maithili', native: 'मैथिली', speaks: false },
  { code: 'doi-IN', english: 'Dogri', native: 'डोगरी', speaks: false },
];

/** Unknown codes fall back to Hindi, the language the app's own screens already speak. */
export function voiceLanguage(code: string | null | undefined): VoiceLanguage {
  return VOICE_LANGUAGES.find((l) => l.code === code) ?? VOICE_LANGUAGES[0];
}

/** Whether Sarvam can read an answer aloud in this exact language. */
export function canSpeak(code: string): boolean {
  return VOICE_LANGUAGES.some((l) => l.code === code && l.speaks);
}

/**
 * The language of a typed question, from its script.
 *
 * Typed questions get no language back from Sarvam, and asking the farmer to
 * pick one would undo the point of the tab. Script is a good enough signal.
 * Devanagari is shared by Hindi, Marathi, Nepali and others, so it keeps
 * whatever Devanagari language the conversation was already in, else Hindi.
 */
export function scriptLanguage(text: string, previous?: string | null): string {
  const scripts: [RegExp, string][] = [
    [/[ঀ-৿]/, 'bn-IN'],
    [/[਀-੿]/, 'pa-IN'],
    [/[઀-૿]/, 'gu-IN'],
    [/[଀-୿]/, 'od-IN'],
    [/[஀-௿]/, 'ta-IN'],
    [/[ఀ-౿]/, 'te-IN'],
    [/[ಀ-೿]/, 'kn-IN'],
    [/[ഀ-ൿ]/, 'ml-IN'],
    [/[؀-ۿ]/, 'ur-IN'],
    [/[᱐-᱿]/, 'sat-IN'],
    [/[ꯀ-꯿]/, 'mni-IN'],
  ];
  for (const [re, code] of scripts) if (re.test(text)) return code;
  if (/[ऀ-ॿ]/.test(text)) {
    const prev = VOICE_LANGUAGES.find((l) => l.code === previous);
    return prev && /[ऀ-ॿ]/.test(prev.native) ? prev.code : 'hi-IN';
  }
  return 'en-IN';
}

/**
 * A recording to upload: anything Blob-shaped. On a phone that is an
 * expo-file-system File (see device.ts for why not a `{ uri }` part); on the
 * web, the Blob behind the recorder's `blob:` URL.
 */
export type AudioUpload = Blob;

/**
 * The content type to upload a recording under, from its file name.
 *
 * Not the type the phone reports: iOS calls a WAV file `audio/vnd.wave`, which
 * Sarvam rejects with a 400 even though it reads WAV perfectly well. Sarvam's
 * own list is checked against, and anything unrecognised goes as
 * `application/octet-stream`, which it accepts and sniffs.
 */
export function uploadType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  const types: Record<string, string> = {
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    aac: 'audio/aac',
    mp3: 'audio/mpeg',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
  };
  return types[ext] ?? 'application/octet-stream';
}

export type VoiceFailure = { ok: false; kind: ChatFailureKind; status?: number; detail?: string };

export type TranscribeResult =
  | { ok: true; transcript: string; language: string }
  | VoiceFailure;

export async function transcribe(req: {
  apiKey: string;
  audio: AudioUpload;
  fetchImpl?: typeof fetch;
}): Promise<TranscribeResult> {
  const form = new FormData();
  form.append('file', req.audio, 'question.m4a');
  form.append('model', STT_MODEL);
  form.append('language_code', 'unknown');

  const res = await post(`${BASE}/speech-to-text`, req.apiKey, form, req.fetchImpl);
  if (!res.ok) return res;

  const body = res.body as { transcript?: unknown; language_code?: unknown };
  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  if (!transcript) return { ok: false, kind: 'empty' };
  const language = typeof body.language_code === 'string' ? body.language_code : 'hi-IN';
  return { ok: true, transcript, language };
}

export type SpeakResult = { ok: true; mp3Base64: string } | VoiceFailure;

export async function synthesize(req: {
  apiKey: string;
  text: string;
  language: string;
  fetchImpl?: typeof fetch;
}): Promise<SpeakResult> {
  if (!canSpeak(req.language)) {
    return { ok: false, kind: 'http', detail: `No Sarvam voice for ${req.language}.` };
  }
  const res = await post(
    `${BASE}/text-to-speech`,
    req.apiKey,
    JSON.stringify({
      text: req.text.slice(0, TTS_MAX_CHARS),
      language_code: req.language,
      model: TTS_MODEL,
      // Measured on a Hindi answer: 16 kHz MP3 came back in 4.3 s against 6.0 s
      // for the default WAV, at a third of the size. A voice on a phone speaker
      // loses nothing at 16 kHz, and a farmer waiting on an answer feels every
      // second.
      speech_sample_rate: 16000,
      output_audio_codec: 'mp3',
    }),
    req.fetchImpl,
  );
  if (!res.ok) return res;

  const audios = (res.body as { audios?: unknown }).audios;
  const first = Array.isArray(audios) ? audios[0] : undefined;
  return typeof first === 'string' && first ? { ok: true, mp3Base64: first } : { ok: false, kind: 'empty' };
}

/** One request to Sarvam, with the auth header, a timeout, and failures typed. */
async function post(
  url: string,
  apiKey: string,
  body: FormData | string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; body: unknown } | VoiceFailure> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        // FormData sets its own multipart boundary; only JSON needs the type.
        ...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    // Kept in `detail` because "network" is also what a malformed request
    // looks like from here, and the underlying message is how to tell.
    const detail = err instanceof Error ? err.message.slice(0, 200) : String(err);
    return { ok: false, kind: aborted ? 'timeout' : 'network', detail };
  } finally {
    clearTimeout(timer);
  }

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // An error page that is not JSON still has a status worth reporting.
  }

  if (!response.ok) {
    const message = (parsed as { error?: { message?: unknown } } | null)?.error?.message;
    const detail = typeof message === 'string' ? message.slice(0, 200) : undefined;
    if (response.status === 401 || response.status === 403) {
      return { ok: false, kind: 'auth', status: response.status, detail };
    }
    if (response.status === 429) return { ok: false, kind: 'rate_limit', status: 429, detail };
    return { ok: false, kind: 'http', status: response.status, detail };
  }
  return parsed ? { ok: true, body: parsed } : { ok: false, kind: 'empty' };
}
