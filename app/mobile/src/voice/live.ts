/**
 * Live captions while the farmer is still speaking: the first of two passes.
 *
 * Sarvam's streaming endpoint only sends text when it decides a stretch of
 * speech has ended, which on fluent speech is the end of the whole question.
 * So this flushes it every FLUSH_MS to force out what it has heard so far.
 * That makes words appear while the farmer talks, at a measured cost: cut
 * mid-word, the stream mishears. On a test question it turned "मेरे गेहूं के
 * खेत" into "उनके खेत" and "दवा छिड़कनी" into nonsense.
 *
 * Which is why this text is only ever a draft. The screen shows it greyed, and
 * when the farmer stops, the whole recording goes to the ordinary endpoint and
 * its transcript replaces the draft. Only that one is sent to the model. The
 * draft is there so the farmer can see they are being heard; it is never what
 * gets answered.
 *
 * Everything here fails quietly: if the socket will not open, the farmer just
 * sees "listening" without words, exactly as before, and the final pass is
 * unaffected.
 *
 * Pure module, no React Native imports. The WebSocket is injectable for tests.
 */

import { STT_MODEL } from './sarvam.ts';

/** How often the stream is forced to give up its draft. ~1.5 s measured as live enough without shredding every word. */
export const FLUSH_MS = 1500;

/** What Sarvam's streaming endpoint takes. */
export const STREAM_RATE = 16000;

const URL_BASE = 'wss://api.sarvam.ai/speech-to-text/ws';

/** The slice of the WebSocket interface this uses, so a fake can stand in. */
export type SocketLike = {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
};

/**
 * Opens a socket with an auth header. React Native's WebSocket takes headers
 * as a third argument; the browser's cannot, and a browser build sends none.
 */
export type SocketFactory = (url: string, headers: Record<string, string>) => SocketLike;

const OPEN = 1;

export class LiveTranscriber {
  private socket: SocketLike | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: string[] = [];
  private segments: string[] = [];
  private closed = false;
  private readonly apiKey: string;
  /** Called with the whole draft so far, every time a piece arrives. */
  private readonly onDraft: (draft: string) => void;
  private readonly openSocket: SocketFactory;

  constructor(apiKey: string, onDraft: (draft: string) => void, openSocket: SocketFactory) {
    this.apiKey = apiKey;
    this.onDraft = onDraft;
    this.openSocket = openSocket;
  }

  start(): void {
    const url =
      `${URL_BASE}?model=${encodeURIComponent(STT_MODEL)}&language-code=unknown` +
      `&sample_rate=${STREAM_RATE}&input_audio_codec=pcm_s16le`;
    try {
      this.socket = this.openSocket(url, { 'Api-Subscription-Key': this.apiKey });
    } catch {
      this.socket = null;
      return;
    }
    const socket = this.socket;
    socket.onopen = () => {
      // Audio captured while the socket was still connecting goes first.
      for (const chunk of this.pending) socket.send(chunk);
      this.pending = [];
      this.timer = setInterval(() => this.flush(), FLUSH_MS);
    };
    socket.onmessage = (event) => this.receive(event.data);
    socket.onerror = () => this.stopTimer();
    socket.onclose = () => this.stopTimer();
  }

  /** One buffer of 16 kHz mono PCM, as little-endian int16. */
  push(pcm16: Uint8Array): void {
    if (this.closed || !this.socket || pcm16.length === 0) return;
    const message = JSON.stringify({
      audio: { data: toBase64(pcm16), sample_rate: String(STREAM_RATE), encoding: 'audio/wav' },
    });
    if (this.socket.readyState === OPEN) this.socket.send(message);
    else this.pending.push(message);
  }

  /** The farmer tapped stop. Ask for the last words, then hang up shortly after. */
  finish(graceMs = 800): void {
    if (this.closed) return;
    this.flush();
    this.stopTimer();
    setTimeout(() => this.close(), graceMs);
  }

  close(): void {
    this.closed = true;
    this.stopTimer();
    try {
      this.socket?.close();
    } catch {
      // Already closed; nothing to do.
    }
    this.socket = null;
  }

  private flush(): void {
    if (this.socket?.readyState === OPEN) this.socket.send(JSON.stringify({ type: 'flush' }));
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private receive(raw: unknown): void {
    if (this.closed || typeof raw !== 'string') return;
    let message: { type?: unknown; data?: { transcript?: unknown } };
    try {
      message = JSON.parse(raw) as typeof message;
    } catch {
      return;
    }
    const text = message.type === 'data' ? message.data?.transcript : undefined;
    if (typeof text !== 'string' || !text.trim()) return;
    this.segments.push(text.trim());
    this.onDraft(this.segments.join(' '));
  }
}

/**
 * Microphone audio to what the stream takes: mono, 16 kHz, int16.
 *
 * The phone is asked for exactly that, but the native side delivers what the
 * hardware gives when it cannot convert, so the rate is checked rather than
 * trusted. Linear interpolation is crude next to a real resampler, and fine
 * for a draft that is thrown away.
 */
export function toStreamPcm(data: ArrayBuffer, sampleRate: number, channels: number): Uint8Array {
  const input = new Int16Array(data);
  const frames = Math.floor(input.length / Math.max(1, channels));

  const mono = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += input[f * channels + c];
    mono[f] = sum / channels;
  }

  const ratio = sampleRate / STREAM_RATE;
  const outFrames = ratio === 1 ? frames : Math.floor(frames / ratio);
  const out = new Int16Array(outFrames);
  for (let i = 0; i < outFrames; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, frames - 1);
    const t = pos - lo;
    out[i] = Math.round(mono[lo] * (1 - t) + mono[hi] * t);
  }
  return new Uint8Array(out.buffer);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Bytes to base64, straight from the bytes. `btoa` would need them turned into
 * a binary string first, and is not something to rely on across every JS
 * engine this runs in, Node's test runner included.
 */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  return out;
}
