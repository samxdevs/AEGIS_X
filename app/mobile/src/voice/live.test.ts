/**
 * The live-caption stream with a fake socket and a fake clock: what it sends,
 * when it flushes, and how the draft builds up.
 *
 *   npm test
 */

import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { FLUSH_MS, LiveTranscriber, toBase64, toStreamPcm } from './live.ts';
import type { SocketLike } from './live.ts';

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readonly url: string;
  readonly headers: Record<string, string>;
  constructor(url: string, headers: Record<string, string>) {
    this.url = url;
    this.headers = headers;
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }
  reply(transcript: string): void {
    this.onmessage?.({ data: JSON.stringify({ type: 'data', data: { transcript, language_code: 'hi-IN' } }) });
  }
}

function setup() {
  let socket: FakeSocket | null = null;
  const drafts: string[] = [];
  const live = new LiveTranscriber('k', (d) => drafts.push(d), (url, headers) => {
    socket = new FakeSocket(url, headers);
    return socket;
  });
  live.start();
  return { live, drafts, socket: socket as unknown as FakeSocket };
}

test('connects with the key in a header and asks Sarvam to detect the language', () => {
  const { socket } = setup();
  assert.equal(socket.headers['Api-Subscription-Key'], 'k');
  assert.match(socket.url, /language-code=unknown/);
  assert.match(socket.url, /input_audio_codec=pcm_s16le/);
  assert.match(socket.url, /sample_rate=16000/);
});

test('audio captured while connecting is sent once the socket opens, in order', () => {
  const { live, socket } = setup();
  live.push(new Uint8Array([1, 2]));
  live.push(new Uint8Array([3, 4]));
  assert.equal(socket.sent.length, 0);
  socket.open();
  const sent = socket.sent.map((s) => (JSON.parse(s) as { audio: { data: string } }).audio.data);
  assert.deepEqual(sent, [toBase64(new Uint8Array([1, 2])), toBase64(new Uint8Array([3, 4]))]);
  live.close();
});

test('it flushes on a timer, so words arrive while the farmer is still talking', () => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  try {
    const { live, socket } = setup();
    socket.open();
    mock.timers.tick(FLUSH_MS * 2);
    assert.equal(socket.sent.filter((s) => s.includes('"flush"')).length, 2);
    live.close();
  } finally {
    mock.timers.reset();
  }
});

test('each piece is appended to the draft', () => {
  const { live, drafts, socket } = setup();
  socket.open();
  socket.reply('मेरे गेहूं');
  socket.reply(' के खेत में ');
  assert.deepEqual(drafts, ['मेरे गेहूं', 'मेरे गेहूं के खेत में']);
  live.close();
});

test('finish asks for the last words, then hangs up; nothing arrives after close', () => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  try {
    const { live, drafts, socket } = setup();
    socket.open();
    live.finish(800);
    assert.ok(socket.sent.at(-1)?.includes('"flush"'));
    socket.reply('आखिरी शब्द');
    mock.timers.tick(800);
    assert.equal(socket.closed, true);
    socket.reply('too late');
    assert.deepEqual(drafts, ['आखिरी शब्द']);
  } finally {
    mock.timers.reset();
  }
});

test('a socket that cannot be opened is not an error: the final pass does not need it', () => {
  const live = new LiveTranscriber('k', () => {}, () => {
    throw new Error('no websocket here');
  });
  live.start();
  live.push(new Uint8Array([1, 2]));
  live.finish();
});

// ---- audio ------------------------------------------------------------------

test('16 kHz mono passes through unchanged', () => {
  const pcm = new Int16Array([100, -200, 300]);
  const out = new Int16Array(toStreamPcm(pcm.buffer, 16000, 1).buffer);
  assert.deepEqual([...out], [100, -200, 300]);
});

test('48 kHz stereo becomes 16 kHz mono', () => {
  // Six stereo frames at 48 kHz: left and right averaged, then every third kept.
  const pcm = new Int16Array([0, 0, 30, 30, 60, 60, 90, 90, 120, 120, 150, 150]);
  const out = new Int16Array(toStreamPcm(pcm.buffer, 48000, 2).buffer);
  assert.deepEqual([...out], [0, 90]);
});

test('base64 matches Node for every padding case', () => {
  for (const len of [0, 1, 2, 3, 4, 5, 100, 3201]) {
    const bytes = new Uint8Array(len).map((_, i) => (i * 37 + 11) & 255);
    assert.equal(toBase64(bytes), Buffer.from(bytes).toString('base64'), `length ${len}`);
  }
});
