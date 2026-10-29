/**
 * The scan-control endpoints (SCAN_CONTROL_API.md §1.2 to §1.8), and the one
 * advisory fetch that follows a walk. The live view's frames (§1.7) are fetched
 * by the page inside the camera WebView, not from here; see pod-camera.tsx.
 *
 * Deliberately separate from `sync/client.ts`'s retrying requests. A 503 there
 * means "the pod is still booting, wait five seconds"; here it can mean the
 * camera is missing, and the status poll runs every second, so a built-in
 * five-second wait would stall the screen rather than help it.
 */

import { ingestAdvisory } from '../db/advisories.ts';
import type { Capture } from '../schema/advisory.ts';
import { HttpError, explain, getAllowMock, getBaseUrl, request } from '../sync/client.ts';
import { readCapture } from './camera.ts';
import { toPodUtc } from './logic.ts';
import type { Crop, ScanSource, ScanStatus, TrackFix } from './logic.ts';
import { tr } from '../i18n/tr.ts';

/** Status polls give up fast so a hung socket cannot pile polls up behind it. */
const STATUS_TIMEOUT_MS = 2500;
const TRACK_TIMEOUT_MS = 4000;
const CONTROL_TIMEOUT_MS = 12_000;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export type StartedScan = {
  scanId: string;
  state: string;
  replay: boolean;
};

/**
 * Why a start was refused, in terms the sheet can act on. `in_progress` carries
 * the scan that is already running so the app can open it rather than fail.
 */
export class StartRefused extends Error {
  constructor(
    readonly kind: 'in_progress' | 'bad_request' | 'camera' | 'other',
    message: string,
    readonly scanId: string | null = null,
  ) {
    super(message);
  }
}

async function url(path: string): Promise<string> {
  return `${await getBaseUrl()}${path}`;
}

export async function startScan(opts: {
  fieldId: string;
  crop: Crop;
  source: ScanSource;
}): Promise<StartedScan> {
  const target = await url('/api/v1/scan/start');
  try {
    const res = await request(
      target,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          field_id: opts.fieldId,
          crop: opts.crop,
          // The phone's clock, which the pod adopts when it has no GPS time.
          phone_utc: toPodUtc(new Date()),
          source: opts.source,
        }),
      },
      CONTROL_TIMEOUT_MS,
    );
    const body = (await res.json()) as { scan_id: string; state?: string; replay?: boolean };
    return { scanId: body.scan_id, state: body.state ?? 'starting', replay: body.replay === true };
  } catch (err) {
    if (err instanceof HttpError) {
      const code = err.body?.error;
      if (err.status === 409) {
        throw new StartRefused(
          'in_progress',
          tr('A scan is already running on the pod.'),
          (err.body as { scan_id?: string } | null)?.scan_id ?? null,
        );
      }
      if (err.status === 400) {
        throw new StartRefused(
          'bad_request',
          err.body?.detail
            ? tr('The pod did not accept that: {detail}', { detail: err.body.detail })
            : tr('The pod did not accept that field or crop.'),
        );
      }
      if (err.status === 503 && code === 'camera_unavailable') {
        throw new StartRefused(
          'camera',
          tr('The pod camera is not available. Check the camera cable, then switch the pod off and on.'),
        );
      }
      if (err.status === 404) {
        throw new StartRefused(
          'other',
          tr('This pod does not support starting a scan from the app yet. It needs the newer pod software.'),
        );
      }
    }
    throw new StartRefused('other', explain(err, target));
  }
}

/** One status poll. Throws when the pod cannot be reached within a moment. */
export async function getScanStatus(): Promise<ScanStatus> {
  const res = await request(await url('/api/v1/scan/status'), {}, STATUS_TIMEOUT_MS);
  return (await res.json()) as ScanStatus;
}

/** Sends a batch of phone GPS fixes. Resolves when the pod accepted them. */
export async function postTrack(scanId: string, fixes: TrackFix[]): Promise<void> {
  await request(
    await url('/api/v1/scan/track'),
    {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ scan_id: scanId, fixes }),
    },
    TRACK_TIMEOUT_MS,
  );
}

/** Where the live view and photos come from: the pod this phone is pointed at. */
export const podBaseUrl = (): Promise<string> => getBaseUrl();

/** A capture is one full-resolution frame classified on the pod: ~1–2 s, more on a weak link. */
const CAPTURE_TIMEOUT_MS = 8000;

export type CaptureOutcome =
  | { ok: true; capture: Capture }
  /** `reason` is null when there is nothing to tell the farmer (a capture already running). */
  | { ok: false; reason: string | null };

/** Asks the pod to check the frame it is seeing now (§1.8). */
export async function captureFrame(scanId: string): Promise<CaptureOutcome> {
  const target = await url('/api/v1/scan/capture');
  try {
    const res = await request(
      target,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ scan_id: scanId }) },
      CAPTURE_TIMEOUT_MS,
    );
    const capture = readCapture(await res.json());
    return capture
      ? { ok: true, capture }
      : { ok: false, reason: tr('The pod sent back a photo result this app cannot read.') };
  } catch (err) {
    if (err instanceof HttpError) {
      const code = err.body?.error;
      if (err.status === 429) return { ok: false, reason: null };
      if (err.status === 409) return { ok: false, reason: tr('Photos can only be taken while the pod is scanning.') };
      if (err.status === 503 && code === 'camera_unavailable') {
        return {
          ok: false,
          reason: tr('The pod camera is not available. Check the camera cable, then switch the pod off and on.'),
        };
      }
      if (err.status === 404 && code !== 'no_such_scan') {
        return { ok: false, reason: tr('This pod cannot take photos yet. It needs the newer pod software.') };
      }
    }
    return { ok: false, reason: explain(err, target) };
  }
}

/** Idempotent on the pod: stopping a scan that is already finishing is fine. */
export async function stopScan(scanId: string): Promise<void> {
  const target = await url('/api/v1/scan/stop');
  try {
    await request(
      target,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ scan_id: scanId }) },
      CONTROL_TIMEOUT_MS,
    );
  } catch (err) {
    throw new Error(explain(err, target));
  }
}

/** Switches the pod off. A running scan is stopped and saved first, by the pod. */
export async function shutdownPod(): Promise<{ afterSeconds: number | null }> {
  const target = await url('/api/v1/pod/shutdown');
  try {
    const res = await request(
      target,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ confirm: true }) },
      CONTROL_TIMEOUT_MS,
    );
    const body = (await res.json().catch(() => null)) as { shutting_down_in_s?: number } | null;
    return { afterSeconds: typeof body?.shutting_down_in_s === 'number' ? body.shutting_down_in_s : null };
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      throw new Error(tr('This pod does not support shutting down from the app yet. It needs the newer pod software.'));
    }
    throw new Error(explain(err, target));
  }
}

/**
 * Fetches the walk's advisory by id, stores it and acknowledges it.
 *
 * Direct, not through the manifest: the pod has just told us its id, and a full
 * sync would also walk the pod's whole backlog before the farmer sees the one
 * report they are waiting for. It leaves the sync cursor alone for the same
 * reason `pullLatest` does, so the next full pull is unaffected and finds this
 * advisory already held.
 */
export async function pullWalkAdvisory(advisoryId: string): Promise<{ advisoryId: string; valid: boolean }> {
  const base = await getBaseUrl();
  const q = (await getAllowMock()) ? '?allow_mock=true' : '';
  const target = `${base}/api/v1/advisory/${encodeURIComponent(advisoryId)}${q}`;
  let payload: unknown;
  let simulated = false;
  try {
    const res = await request(target, {}, CONTROL_TIMEOUT_MS);
    payload = await res.json();
    simulated = res.headers.get('x-aegis-simulated') === 'true';
  } catch (err) {
    throw new Error(explain(err, target));
  }
  const stored = await ingestAdvisory(payload, simulated ? { origin: 'fixture' } : {});
  try {
    await request(
      `${base}/api/v1/ack`,
      { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ advisory_id: stored.advisoryId }) },
      CONTROL_TIMEOUT_MS,
    );
  } catch {
    // An ack is a courtesy: the report is already on the phone.
  }
  return { advisoryId: stored.advisoryId, valid: stored.valid };
}
