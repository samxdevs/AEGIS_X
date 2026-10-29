/**
 * The pod camera on the live screen: whether the picture is live, and what a
 * captured photo says (SCAN_CONTROL_API.md §1.7, §1.8).
 *
 * The feed's one hard rule is that a still picture must never pass for a live
 * one. A farmer aiming the pod at a plant trusts that what they see is what the
 * camera sees now. So "live" is earned by new frames (a rising X-Frame-Seq),
 * not by the connection being open, and after STALE_AFTER_MS without one the
 * feed says it has paused.
 *
 * Pure module, no React Native imports — it runs under `node --test`.
 */

import { tr } from '../i18n/tr.ts';
import type { Capture } from '../schema/advisory.ts';
import { describeClass } from '../schema/classes.ts';
import { inSentence } from './report.ts';

/** About 8 frames a second asked for; the pod's budget is ≤ 10. */
export const FRAME_INTERVAL_MS = 125;

/**
 * The pod's IMX219 is mounted upside down on the rod, and the pod sends
 * frames as the sensor reads them. Turned here rather than on the pod so the
 * model and the saved photos keep the orientation they were tested with.
 */
export const POD_CAMERA_UPSIDE_DOWN = true;

/** No new frame for this long and the feed stops claiming to be live. */
export const STALE_AFTER_MS = 2500;

export type FeedState =
  | { kind: 'waiting' }
  | { kind: 'live'; replay: boolean }
  | { kind: 'paused' }
  /** The camera endpoint is not on this pod's software. */
  | { kind: 'unsupported' }
  | { kind: 'unavailable' };

/** What the feed has heard, as the page inside the WebView reports it. */
export type FeedEvidence = {
  /** When a frame with a new sequence number last arrived; null before the first. */
  lastNewFrameAtMs: number | null;
  replay: boolean;
  /** The last non-image answer: 404, 409, 503 and so on. Null after a good frame. */
  lastStatus: number | null;
};

export function feedState(e: FeedEvidence, nowMs: number): FeedState {
  if (e.lastStatus === 404) return { kind: 'unsupported' };
  if (e.lastStatus === 503) return { kind: 'unavailable' };
  if (e.lastNewFrameAtMs === null) return { kind: 'waiting' };
  if (nowMs - e.lastNewFrameAtMs > STALE_AFTER_MS) return { kind: 'paused' };
  return { kind: 'live', replay: e.replay };
}

/**
 * Reads a capture response defensively. A field missing or of the wrong type
 * is null rather than a guess, and a response without its id, time or image is
 * not a capture at all.
 */
export function readCapture(body: unknown): Capture | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const id = num(b.capture_id);
  const utc = str(b.utc);
  const imagePath = str(b.image_path);
  if (id === null || !utc || !imagePath) return null;
  return {
    capture_id: id,
    utc,
    media_id: str(b.media_id) ?? '',
    image_path: imagePath,
    quality: str(b.quality) ?? 'OK',
    verdict: str(b.verdict) ?? 'NO_DATA',
    top_class: str(b.top_class),
    confidence: num(b.confidence),
    cross_source_reliability: str(b.cross_source_reliability),
    lat: num(b.lat),
    lon: num(b.lon),
    pos_accuracy_m: num(b.pos_accuracy_m),
    pos_source: str(b.pos_source),
  };
}

export type CaptureTone = 'bad' | 'good' | 'warn' | 'unknown';

/**
 * What a capture card says, in the same voice as an alert: a disease is only
 * ever "possible", always with "check by eye", and a photo the pod could not
 * judge says why rather than nothing.
 */
export function describeCapture(c: Capture): { headline: string; tone: CaptureTone } {
  if (c.verdict === 'DISEASE' && c.top_class) {
    const disease = inSentence(describeClass(c.top_class).condition);
    return { headline: tr('Possible {disease}. Check this plant by eye.', { disease }), tone: 'bad' };
  }
  switch (c.verdict) {
    case 'HEALTHY':
      return { headline: tr('Looks healthy in this photo.'), tone: 'good' };
    case 'UNCERTAIN':
      return { headline: tr('Not clear from this photo. Capture again closer, or check by eye.'), tone: 'warn' };
    case 'NOT_CROP':
      return { headline: tr('This photo is mostly not crop. Point the pod at the leaves.'), tone: 'warn' };
  }
  switch (c.quality) {
    case 'BLURRY':
      return { headline: tr('Too blurry to check. Hold the pod still and capture again.'), tone: 'unknown' };
    case 'TOO_DARK':
      return { headline: tr('Too dark to check. Move out of the shade and capture again.'), tone: 'unknown' };
    case 'TOO_BRIGHT':
      return { headline: tr('Too much glare to check. Tilt the pod away from the sun and capture again.'), tone: 'unknown' };
  }
  return { headline: tr('The pod could not check this photo.'), tone: 'unknown' };
}
