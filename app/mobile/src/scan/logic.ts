/**
 * The scan-control rules that are not about the screen.
 *
 * Everything here is plain TypeScript with no React Native import, so it runs
 * under `node --test`. The wording of the warnings lives here too: the pod sends
 * a code and the app owns the sentence (SCAN_CONTROL_API.md §3).
 */

import { msg, tr } from '../i18n/tr.ts';

// ---- Wire shapes (SCAN_CONTROL_API.md §1) ---------------------------------

export type Crop = 'wheat' | 'rice' | 'sugarcane';

export const CROPS: readonly Crop[] = ['wheat', 'rice', 'sugarcane'];

export type ScanSource = 'camera' | 'replay';

export type PodScanState = 'idle' | 'starting' | 'scanning' | 'finalizing' | 'done' | 'error';

export type PodWarning = { code: string; since_utc?: string };

export type ScanAlert = {
  alert_id: number;
  utc: string;
  /** e.g. "wheat__brown_rust". */
  class: string;
  frames_agreeing: number;
  lat: number | null;
  lon: number | null;
  pos_accuracy_m: number | null;
};

export type ScanCounts = {
  frames_seen?: number;
  frames_used?: number;
  stretches?: number;
  healthy?: number;
  need_look?: number;
  unclear?: number;
  not_crop?: number;
};

export type ScanStatus = {
  state: PodScanState;
  scan_id?: string | null;
  field_id?: string | null;
  crop?: string | null;
  replay?: boolean;
  started_utc?: string | null;
  elapsed_s?: number | null;
  max_duration_s?: number | null;
  counts?: ScanCounts | null;
  thermal_c_latest?: number | null;
  field_station?: {
    reachable?: boolean;
    readings_collected?: number;
    last_reading_utc?: string | null;
  } | null;
  warnings?: PodWarning[] | null;
  alerts?: ScanAlert[] | null;
  advisory_id?: string | null;
  stop_reason?: string | null;
};

export type TrackFix = {
  utc: string;
  lat: number;
  lon: number;
  accuracy_m: number;
  speed_mps: number | null;
};

// ---- Warning wording ------------------------------------------------------

/** Spec §3, exactly. Hindi is in `i18n/hi/walk.ts`. */
const POD_WARNING_TEXT: Record<string, string> = {
  TOO_DARK: msg('Too dark to see the leaves. Scan in daylight or move out of the shade.'),
  TOO_BRIGHT: msg('Too much glare. Tilt the pod away from the sun.'),
  BLURRY_SLOW_DOWN: msg('Walk slower. Pictures are coming out blurry.'),
  NOT_SEEING_CROP: msg('Not able to see the leaves clearly. Point it towards the crop.'),
  FIELD_STATION_NOT_FOUND: msg(
    'Field station not found. Check that it is switched on. The scan continues without weather and soil data.',
  ),
  POD_HOT: msg('Pod is getting hot. Keep it out of direct sun.'),
  STORAGE_LOW: msg('Pod storage almost full.'),
  STORAGE_CARD_MISSING: msg("Storage card not found. Saving to the pod's internal memory."),
};

/**
 * The sentence for a pod warning code.
 *
 * A code this build does not know is shown as a plain notice with the code
 * opened out, rather than hidden: the pod raised it for a reason, and a farmer
 * is better served by "Pod notice: low voltage" than by silence.
 */
export function podWarningText(code: string): string {
  const known = POD_WARNING_TEXT[code];
  if (known) return tr(known);
  return tr('Pod notice: {code}', { code: code.toLowerCase().replace(/_/g, ' ') });
}

/** Phone has not heard from the pod for this long: it is out of range. */
export const POD_SILENT_AFTER_MS = 6000;

/** Below this the phone battery warning shows. */
export const BATTERY_LOW_FRACTION = 0.2;

export type AppWarning = { key: 'pod_far' | 'battery_low'; text: string };

/**
 * The two warnings the app raises on its own.
 *
 * `lastStatusAtMs` is when the last status poll succeeded; null before the first
 * one, which is not "too far" yet, only "not heard from yet".
 */
export function appWarnings(input: {
  nowMs: number;
  lastStatusAtMs: number | null;
  batteryLevel: number | null;
}): AppWarning[] {
  const out: AppWarning[] = [];
  const { nowMs, lastStatusAtMs, batteryLevel } = input;
  if (lastStatusAtMs !== null && nowMs - lastStatusAtMs >= POD_SILENT_AFTER_MS) {
    out.push({
      key: 'pod_far',
      text: tr(
        "Can't reach the pod. If you walked away from it, walk closer. If it lost power, switch it on. The walk so far is saved.",
      ),
    });
  }
  // expo-battery reports -1 when it cannot read the level; that is not "0 %".
  if (batteryLevel !== null && batteryLevel >= 0 && batteryLevel < BATTERY_LOW_FRACTION) {
    out.push({
      key: 'battery_low',
      text: tr('Phone battery low ({n}%). Charge soon.', { n: Math.round(batteryLevel * 100) }),
    });
  }
  return out;
}

// ---- Alerts ---------------------------------------------------------------

/**
 * The alerts the phone has not buzzed for yet.
 *
 * `alert_id` is strictly increasing within a scan, so "seen" is one number. Each
 * new id vibrates once; a status that repeats the last 20 alerts every second
 * never re-triggers.
 */
export function freshAlerts(
  alerts: ScanAlert[] | null | undefined,
  lastSeenId: number,
): { fresh: ScanAlert[]; lastSeenId: number } {
  const fresh = (alerts ?? []).filter((a) => a.alert_id > lastSeenId);
  fresh.sort((a, b) => a.alert_id - b.alert_id);
  const top = fresh.length > 0 ? fresh[fresh.length - 1].alert_id : lastSeenId;
  return { fresh, lastSeenId: top };
}

export function highestAlertId(alerts: ScanAlert[] | null | undefined): number {
  return (alerts ?? []).reduce((m, a) => Math.max(m, a.alert_id), 0);
}

// ---- Time -----------------------------------------------------------------

/** "2026-10-03T04:30:12Z": the form the pod expects, with no milliseconds. */
export function toPodUtc(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Seconds to show on the big timer.
 *
 * The pod's `elapsed_s` is only as fresh as the last poll, so the phone adds the
 * time since then. When the pod has gone quiet the count carries on, because the
 * pod is still scanning, and it is capped at the pod's own limit.
 */
export function displayElapsed(
  elapsedS: number | null | undefined,
  receivedAtMs: number | null,
  nowMs: number,
  maxS?: number | null,
): number | null {
  if (typeof elapsedS !== 'number' || receivedAtMs === null) return null;
  const extra = Math.max(0, Math.floor((nowMs - receivedAtMs) / 1000));
  const total = elapsedS + extra;
  return typeof maxS === 'number' && maxS > 0 ? Math.min(total, maxS) : total;
}

/** 312 -> "5:12", 3725 -> "1:02:05". */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

// ---- GPS track queue ------------------------------------------------------

/** Most fixes held while the pod cannot be reached: about 20 minutes at 2 s. */
export const TRACK_QUEUE_LIMIT = 600;

/** Most fixes in one POST. */
export const TRACK_BATCH = 100;

/**
 * Fixes waiting to go to the pod.
 *
 * A fix is only removed once the pod has accepted the batch it was in, so a
 * dropped link loses nothing: the next flush sends them again, with the newer
 * ones behind. If the pod stays away longer than the limit the oldest are
 * dropped, which costs the start of a long outage rather than the end of it.
 */
export class TrackQueue {
  private items: TrackFix[] = [];
  private sending = false;
  private readonly limit: number;

  // No `private limit` parameter property: Node's type stripping, which runs
  // the tests, does not support them.
  constructor(limit = TRACK_QUEUE_LIMIT) {
    this.limit = limit;
  }

  get size(): number {
    return this.items.length;
  }

  push(fix: TrackFix): void {
    this.items.push(fix);
    if (this.items.length > this.limit) this.items.splice(0, this.items.length - this.limit);
  }

  /**
   * Sends everything queued, a batch at a time, stopping at the first failure.
   * Only one flush runs at once; a second call while one is in flight does
   * nothing. Returns how many fixes were accepted.
   */
  async flush(send: (batch: TrackFix[]) => Promise<void>): Promise<number> {
    if (this.sending) return 0;
    this.sending = true;
    let sent = 0;
    try {
      while (this.items.length > 0) {
        const batch = this.items.slice(0, TRACK_BATCH);
        try {
          await send(batch);
        } catch {
          break;
        }
        // Fixes pushed while the request was out are behind the batch, so the
        // batch is still the first `batch.length` items.
        this.items.splice(0, batch.length);
        sent += batch.length;
      }
    } finally {
      this.sending = false;
    }
    return sent;
  }
}

/**
 * A phone location reading as a track fix, or null when it cannot be used.
 *
 * A fix with no stated accuracy is dropped: the pod decides whether to use a
 * position by its accuracy, and a position that cannot say how good it is is not
 * one to send. Speed is null when the phone has none (it reports -1 or nothing).
 */
export function toTrackFix(
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
  },
  timestampMs: number,
): TrackFix | null {
  if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return null;
  if (typeof coords.accuracy !== 'number' || !Number.isFinite(coords.accuracy)) return null;
  const speed =
    typeof coords.speed === 'number' && Number.isFinite(coords.speed) && coords.speed >= 0
      ? Math.round(coords.speed * 100) / 100
      : null;
  return {
    utc: toPodUtc(new Date(timestampMs)),
    lat: coords.latitude,
    lon: coords.longitude,
    accuracy_m: Math.round(coords.accuracy * 10) / 10,
    speed_mps: speed,
  };
}
