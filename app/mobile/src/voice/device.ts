/**
 * The phone side of the voice loop: which key to use, how a recording becomes
 * an upload, and how a spoken answer gets played.
 *
 * Spoken answers are written to the cache directory and played from there, so
 * replaying one costs nothing and works with no signal. On the web there is no
 * file system, and a data URI plays directly.
 */

import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

import { BUILD_SARVAM_KEY } from '../llm/client.ts';
import { getLlmSettings } from '../llm/settings.ts';
import type { SocketFactory, SocketLike } from './live.ts';
import { uploadType } from './sarvam.ts';
import type { AudioUpload } from './sarvam.ts';

/**
 * React Native's WebSocket takes a third argument with headers, which is how
 * Sarvam wants the key; the DOM type the compiler knows has no such argument.
 */
type HeaderSocket = new (
  url: string,
  protocols: string[] | undefined,
  options: { headers: Record<string, string> },
) => SocketLike;

export const openSarvamSocket: SocketFactory = (url, headers) =>
  new (WebSocket as unknown as HeaderSocket)(url, undefined, { headers });

/**
 * The Sarvam key the voice uses: one saved on the Profile screen under Sarvam,
 * whichever provider writes the answers, else the build-time one.
 */
export function sarvamKey(): string | null {
  const saved = getLlmSettings().providers.sarvam?.apiKey.trim();
  return saved || BUILD_SARVAM_KEY?.trim() || null;
}

export async function recordingUpload(uri: string): Promise<AudioUpload> {
  if (Platform.OS === 'web') return (await fetch(uri)).blob();
  // From SDK 58 the global fetch is expo/fetch, which rejects React Native's
  // `{ uri, name, type }` FormData part outright, and the rejection surfaces
  // as an ordinary "network" failure on a phone with perfectly good signal.
  // It reads anything with a `bytes()` method instead, so the file's bytes go
  // through a File, under a name and type set here rather than the phone's own
  // (see uploadType). The recording is WAV from the live stream, or AAC in
  // .m4a from the fallback recorder.
  const file = new File(uri);
  const part = {
    name: file.name,
    type: uploadType(file.name),
    bytes: async () => new Uint8Array(await file.arrayBuffer()),
  };
  return part as unknown as AudioUpload;
}

/** Saves a spoken answer and returns something the player can open. */
export function saveAnswerAudio(id: string, mp3Base64: string): string {
  if (Platform.OS === 'web') return `data:audio/mpeg;base64,${mp3Base64}`;
  const file = new File(Paths.cache, `ask-answer-${id}.mp3`);
  file.write(mp3Base64, { encoding: 'base64' });
  return file.uri;
}

let current: AudioPlayer | null = null;

/** Plays one answer, stopping whatever was playing: two voices at once help nobody. */
export async function playAnswer(uri: string): Promise<void> {
  stopAnswer();
  // Recording switches iOS to the earpiece-and-mic route; playback has to ask
  // for the speaker back, and should play even with the silent switch on.
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  current = createAudioPlayer(uri);
  current.play();
}

export function stopAnswer(): void {
  current?.remove();
  current = null;
}
