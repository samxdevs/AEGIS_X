/**
 * A fake pod, serving the v1.0 gateway API from the fixtures.
 *
 *   npm run station
 *
 * The point of this file: no connectivity demo is possible until the pod's
 * SIH-FIELD access point has its replacement WiFi adapter. That blocks the
 * *radio*, not the protocol — localhost is a link. The delta pull, the cursor,
 * paging, idempotence, resumability, the production mock guard, the mast sync
 * seam and the trap upload can all be exercised and fixed today against this,
 * and the app cannot tell the difference except where we make sure it can.
 *
 * It serves the fixtures, five of which are invented. So every advisory
 * response carries `x-aegis-simulated: true`, and the app stores anything
 * pulled from here as origin 'fixture' and labels it SAMPLE DATA. A simulator
 * that let invented numbers arrive looking measured would be building the
 * project's own worst failure mode into the test rig.
 *
 * Every route, status code and error body below is transcribed from
 * `docs/APP_TEAM_CHANGES.md` §5 and §6. Where the contract names an error the
 * app has to handle — 403 on a mock advisory, 409 on a concurrent mast sync,
 * 410 on pruned media, 503 with Retry-After at boot — this serves it on demand,
 * because a failure path that has never once been seen is a failure path that
 * does not work.
 *
 * Flags:
 *   --port 8080      listen port
 *   --flaky          fail ~1 request in 3, to exercise resumability
 *   --slow 800       delay each response by N ms
 *   --booting 20     answer 503 with Retry-After for the first N seconds
 *   --allow-mock     serve mock-backend advisories instead of 403-ing them
 *   --no-mast        make the ground mast unreachable
 *
 * Scan control (SCAN_CONTROL_API.md), the walk the farmer runs from the app:
 *   --not-ready 20   pod_ready stays false for the first N seconds
 *   --no-camera      POST /scan/start answers 503 camera_unavailable
 *   --no-station     the field station is not found: FIELD_STATION_NOT_FOUND
 *   --no-gps         the pod has no GPS time: clock_source "filesystem" until a
 *                    scan starts and the phone's time is adopted ("phone")
 *   --stretch 20     seconds per stretch (use 5 to see a walk fill up quickly)
 *   --alert-every 1  raise an alert on every Nth DISEASE stretch
 *   --finalize 6     seconds spent "finalizing" after Stop
 *   --max 1800       the pod's own time limit in seconds (try 60 to see it hit)
 *
 * Live camera and Capture (SCAN_CONTROL_API.md §1.7, §1.8). The frames are
 * drawings in tools/fake-camera/, labelled SIMULATED on every frame, and the
 * capture verdicts follow a fixed cycle; neither is a measurement of anything.
 *   --freeze-camera 15  the preview stops advancing N s into a scan, so the
 *                       app's "feed paused" path can be seen
 */

import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1] ?? true);
};

const PORT = Number(flag('port', 8080));
const FLAKY = argv.includes('--flaky');
const SLOW = Number(flag('slow', 0));
const BOOTING = Number(flag('booting', 0));
const ALLOW_MOCK = argv.includes('--allow-mock');
const NO_MAST = argv.includes('--no-mast');
const NOT_READY = Number(flag('not-ready', 0));
const NO_CAMERA = argv.includes('--no-camera');
const NO_STATION = argv.includes('--no-station');
const NO_GPS = argv.includes('--no-gps');
const STRETCH_S = Number(flag('stretch', 20));
const ALERT_EVERY = Number(flag('alert-every', 1));
const FINALIZE_S = Number(flag('finalize', 6));
const MAX_S = Number(flag('max', 1800));
const FREEZE_CAMERA_S = Number(flag('freeze-camera', 0));

const STARTED = Date.now();
const FIXTURE_DIR = fileURLToPath(new URL('../fixtures/', import.meta.url).href);
const CAMERA_DIR = fileURLToPath(new URL('./fake-camera/', import.meta.url).href);

/** The simulated preview: a slow pan, looped. */
const cameraFrames = readdirSync(CAMERA_DIR)
  .filter((f) => f.endsWith('.jpg'))
  .sort()
  .map((f) => readFileSync(CAMERA_DIR + f));
/** ~10 preview frames a second, the top of the §1.7 budget. */
const FRAME_MS = 100;

const advisories = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(FIXTURE_DIR + f, 'utf8')))
  // Ordered by seq, ascending, because that is what the cursor walks. The real
  // pod cannot order these by timestamp either: it has no battery-backed clock,
  // so generated_at_utc can go backwards across a reboot.
  .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

/** Highest seq the client has acknowledged. Only affects the /health count. */
let acked = 0;

/**
 * The AP/STA seam, simulated.
 *
 * The real pod has one radio. Collecting from the ground mast means dropping
 * its own access point and joining the mast's as a station, during which the
 * phone cannot reach it at all. That is the single most confusing thing this
 * system does to a client, so the simulator reproduces it rather than returning
 * a tidy success — including the window where every other endpoint goes dark.
 */
const mast = {
  syncing: false,
  syncUntil: 0,
  last_success_utc: null,
  last_attempt_utc: null,
  last_result: null,
  mast_data_age_s: null,
  records_pulled: 0,
  trap_images_pulled: 0,
};

// ---- Scan control -----------------------------------------------------------
//
// One walk at a time, driven by the real clock. Stretch verdicts follow a fixed
// pattern so a demo looks the same every run: mostly healthy, a few unclear, the
// odd not-crop, and every seventh a possible disease of the declared crop.
// The finished advisory reuses the healthy fixture's blocks (actions, growth
// stage and so on) under the walk fields, so it is a stand-in, not real advice.

const DISEASE_BY_CROP = {
  wheat: 'wheat__brown_rust',
  rice: 'rice__blast',
  sugarcane: 'sugarcane__red_rot',
};

/** The scan in progress or just finished. null before the first Start. */
let scan = null;
let podOff = false;

const verdictOf = (i) =>
  i % 7 === 5 ? 'DISEASE' : i % 9 === 3 ? 'UNCERTAIN' : i % 13 === 8 ? 'NOT_CROP' : 'HEALTHY';

const isoAt = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

const elapsedS = () => {
  if (!scan) return 0;
  const end = scan.stoppedAt ?? Date.now();
  return Math.max(0, Math.floor((end - scan.startedAt) / 1000));
};

/** The phone fix nearest a moment, within the pod's 3 s rule, or null. */
function fixNear(ms) {
  if (!scan) return null;
  let best = null;
  for (const f of scan.fixes) {
    if (f.accuracy_m > 25) continue; // stored, not used for positions
    const d = Math.abs(Date.parse(f.utc) - ms);
    if (d <= 3000 && (!best || d < best.d)) best = { d, f };
  }
  return best ? best.f : null;
}

const position = (ms) => {
  const f = fixNear(ms);
  return f
    ? { lat: f.lat, lon: f.lon, pos_accuracy_m: f.accuracy_m, pos_source: 'phone_gps' }
    : { lat: null, lon: null, pos_accuracy_m: null, pos_source: null };
};

/** Stretches that have closed by now. */
function stretches() {
  const done = Math.floor(elapsedS() / STRETCH_S);
  const out = [];
  for (let i = 0; i < done; i++) {
    const start = scan.startedAt + i * STRETCH_S * 1000;
    const verdict = verdictOf(i);
    out.push({
      index: i,
      start_utc: isoAt(start),
      end_utc: isoAt(start + STRETCH_S * 1000),
      frames_used: 10 + (i % 6),
      verdict,
      top_class: verdict === 'DISEASE' ? DISEASE_BY_CROP[scan.crop] : null,
      frames_agreeing: verdict === 'DISEASE' ? 3 + (i % 3) : 0,
      thermal_median_c: scan.replay ? null : Number((28.5 + Math.sin(i) * 0.8).toFixed(1)),
      ...position(start + (STRETCH_S * 1000) / 2),
    });
  }
  return out;
}

/** An alert fires mid-way through each (Nth) disease stretch, once it is under way. */
function alerts() {
  if (!scan) return [];
  const out = [];
  let id = 0;
  let n = 0;
  const elapsedMs = elapsedS() * 1000;
  for (let i = 0; i * STRETCH_S * 1000 <= elapsedMs; i++) {
    if (verdictOf(i) !== 'DISEASE') continue;
    n++;
    if (n % ALERT_EVERY !== 0) continue;
    const at = i * STRETCH_S * 1000 + (STRETCH_S * 1000) / 2;
    if (at > elapsedMs) continue;
    id++;
    const t = scan.startedAt + at;
    const pos = position(t);
    out.push({
      alert_id: id,
      utc: isoAt(t),
      class: DISEASE_BY_CROP[scan.crop],
      frames_agreeing: 3 + (i % 3),
      lat: pos.lat,
      lon: pos.lon,
      pos_accuracy_m: pos.pos_accuracy_m,
    });
  }
  return out.slice(-20);
}

function activeWarnings() {
  const e = elapsedS();
  const w = [];
  const since = (sec) => ({ since_utc: isoAt(scan.startedAt + sec * 1000) });
  if (NO_STATION) w.push({ code: 'FIELD_STATION_NOT_FOUND', ...since(0) });
  if (e % 60 >= 20 && e % 60 < 32) w.push({ code: 'BLURRY_SLOW_DOWN', ...since(e - (e % 60) + 20) });
  if (e % 60 >= 45 && e % 60 < 52) w.push({ code: 'TOO_BRIGHT', ...since(e - (e % 60) + 45) });
  return w;
}

/** Moves a running scan along: starting -> scanning, the time limit, finalizing -> done. */
function advanceScan() {
  if (!scan) return;
  const now = Date.now();
  if (scan.state === 'starting' && now - scan.startedAt >= 3000) scan.state = 'scanning';
  if (scan.state === 'scanning' && elapsedS() >= MAX_S) beginFinalizing('time_limit');
  if (scan.state === 'finalizing' && now >= scan.finalizeAt) finishScan();
}

function beginFinalizing(reason) {
  if (scan.state === 'finalizing' || scan.state === 'done') return;
  scan.state = 'finalizing';
  scan.stoppedAt = Date.now();
  scan.stopReason = reason;
  scan.finalizeAt = Date.now() + FINALIZE_S * 1000;
  console.log(`  ⏹ finalizing (${reason}) for ${FINALIZE_S}s`);
}

/** Writes the walk advisory (spec section 2) and makes it fetchable like any other. */
function finishScan() {
  const list = stretches();
  const count = (v) => list.filter((x) => x.verdict === v).length;
  const needLook = count('DISEASE');
  const placed = list.filter((x) => typeof x.lat === 'number').length;
  const base = JSON.parse(
    JSON.stringify(
      advisories.find((a) => a.advisory_id.includes('F01') && a.crop_health.state === 'HEALTHY') ?? advisories[0],
    ),
  );
  const seq = Math.max(0, ...advisories.map((a) => a.seq ?? 0)) + 1;
  const walkAlerts = alerts();
  const detections = walkAlerts
    .filter((a) => typeof a.lat === 'number')
    .map((a) => ({
      class: a.class,
      confidence: 0.86,
      cross_source_reliability: 'TESTED_WEAK',
      lat: a.lat,
      lon: a.lon,
      fix_quality: 1,
      hdop: 1.2,
      captured_utc: a.utc.replace('Z', '.000000+00:00'),
      source: 'measured',
    }));

  const station = NO_STATION
    ? {
        available: false,
        reason: 'NO_VALID_MAST_READING',
        node_id: null,
        reading_utc: null,
        age_minutes: null,
        air_temp_c: null,
        rh_pct: null,
        lux: null,
        soil1_v: null,
        soil2_v: null,
        battery_v: null,
        soil_units: 'raw_volts_uncalibrated',
        source: null,
      }
    : {
        available: true,
        reason: null,
        node_id: 'SIH-NODE-01',
        reading_utc: isoAt(scan.startedAt),
        age_minutes: 0.4,
        air_temp_c: 27.1,
        rh_pct: 61.2,
        lux: 1840.0,
        soil1_v: 2.41,
        soil2_v: 2.38,
        battery_v: 3.27,
        soil_units: 'raw_volts_uncalibrated',
        source: 'measured',
      };

  const adv = {
    ...base,
    advisory_id: scan.scanId,
    seq,
    generated_at_utc: isoAt(Date.now()),
    replay: scan.replay,
    scan: {
      ...base.scan,
      started_utc: isoAt(scan.startedAt),
      ended_utc: isoAt(scan.stoppedAt),
      mode: 'walk',
      frames_captured: Math.floor(elapsedS() * 30),
      frames_evaluated: list.reduce((n, x) => n + x.frames_used, 0),
      tiles_classified: list.reduce((n, x) => n + x.frames_used, 0) * 9,
      distance_walked_m: null,
      distance_reason: 'GPS_TRACK_NOT_RECORDED',
      crop_declared: scan.crop,
      duration_s: elapsedS(),
      stop_reason: scan.stopReason,
    },
    crop_health: {
      ...base.crop_health,
      state: needLook > 0 ? 'DISEASE' : 'HEALTHY',
      crop: scan.crop,
    },
    time_source: NO_GPS ? 'phone' : 'gps',
    summary: {
      stretches_total: list.length,
      healthy: count('HEALTHY'),
      need_look: needLook,
      unclear: count('UNCERTAIN'),
      not_crop: count('NOT_CROP'),
      no_data: count('NO_DATA'),
    },
    stretches: list,
    alerts: walkAlerts,
    captures: scan.captures,
    detections,
    disease:
      needLook > 0
        ? [{ class: DISEASE_BY_CROP[scan.crop], confidence: 0.86, media_ids: [], source: 'measured' }]
        : [],
    gps: {
      status: placed > 0 ? 'OK' : 'ABSENT',
      point_count: placed,
      accuracy_note: 'Positions from the phone, as sent during the walk.',
      source: 'phone_gps',
    },
    field_conditions: station,
  };
  advisories.push(adv);
  scan.state = 'done';
  scan.advisoryId = adv.advisory_id;
  console.log(`  ✓ walk advisory ${adv.advisory_id} written (${list.length} stretches, ${needLook} need a look)`);
}

const scanStatus = () => {
  advanceScan();
  if (!scan) return { state: 'idle', scan_id: null, advisory_id: null, stop_reason: null };
  const list = scan.state === 'starting' ? [] : stretches();
  const count = (v) => list.filter((x) => x.verdict === v).length;
  const used = list.reduce((n, x) => n + x.frames_used, 0);
  return {
    state: scan.state,
    scan_id: scan.scanId,
    field_id: scan.fieldId,
    crop: scan.crop,
    replay: scan.replay,
    started_utc: isoAt(scan.startedAt),
    elapsed_s: elapsedS(),
    max_duration_s: MAX_S,
    counts: {
      frames_seen: elapsedS() * 30,
      frames_used: used,
      stretches: list.length,
      healthy: count('HEALTHY'),
      need_look: count('DISEASE'),
      unclear: count('UNCERTAIN'),
      not_crop: count('NOT_CROP'),
    },
    thermal_c_latest: scan.replay ? null : Number((28.5 + Math.sin(elapsedS() / 7)).toFixed(1)),
    field_station: {
      reachable: !NO_STATION,
      readings_collected: NO_STATION ? 0 : 12 + Math.floor(elapsedS() / 5),
      last_reading_utc: NO_STATION ? null : isoAt(Date.now() - 3000),
    },
    warnings: scan.state === 'scanning' ? activeWarnings() : [],
    alerts: alerts(),
    advisory_id: scan.advisoryId ?? null,
    stop_reason: scan.stopReason ?? null,
  };
};

const podReady = () => !NOT_READY || Date.now() - STARTED >= NOT_READY * 1000;
/** Photos taken with Capture, served back from /api/v1/media/. */
const capturedMedia = new Map();

/** The preview frame showing now, or null in the camera's first moment. */
function previewFrame() {
  if (cameraFrames.length === 0) return null;
  let ms = Date.now() - scan.startedAt;
  if (ms < 500) return null;
  if (FREEZE_CAMERA_S > 0) ms = Math.min(ms, FREEZE_CAMERA_S * 1000);
  const seq = Math.floor(ms / FRAME_MS);
  return { seq, atMs: scan.startedAt + seq * FRAME_MS, jpeg: cameraFrames[seq % cameraFrames.length] };
}

/**
 * One photo, checked. The verdicts cycle so every card the app can draw turns
 * up within four taps: a possible disease, healthy, unclear, and a photo too
 * blurry to judge.
 */
const CAPTURE_CYCLE = ['DISEASE', 'HEALTHY', 'UNCERTAIN', 'BLURRY'];

function takeCapture() {
  const id = scan.captures.length + 1;
  const now = Date.now();
  const kind = CAPTURE_CYCLE[(id - 1) % CAPTURE_CYCLE.length];
  const mediaId = `cap_${scan.scanId}_${id}`;
  capturedMedia.set(mediaId, previewFrame()?.jpeg ?? cameraFrames[0]);
  const blurry = kind === 'BLURRY';
  const capture = {
    capture_id: id,
    utc: isoAt(now),
    media_id: mediaId,
    image_path: `/api/v1/media/${encodeURIComponent(mediaId)}`,
    quality: blurry ? 'BLURRY' : 'OK',
    verdict: blurry ? 'NO_DATA' : kind,
    top_class: kind === 'DISEASE' ? DISEASE_BY_CROP[scan.crop] : null,
    confidence: blurry ? null : kind === 'DISEASE' ? 0.91 : kind === 'HEALTHY' ? 0.88 : 0.52,
    cross_source_reliability: kind === 'DISEASE' ? 'TESTED_WEAK' : null,
    ...position(now),
  };
  scan.captures.push(capture);
  return capture;
}

const scanBusy = () => !!scan && ['starting', 'scanning', 'finalizing'].includes(scan.state);

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  try {
    return { ok: true, value: JSON.parse(body || '{}') };
  } catch (err) {
    return { ok: false, detail: `Malformed JSON: ${err.message}` };
  }
}

const isSyncing = () => mast.syncing && Date.now() < mast.syncUntil;
const nowUtc = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const send = (res, status, body, headers = {}) => {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
};

/** Contract §3: production mode refuses anything the mock backend produced. */
const isMock = (a) => a.inference_backend === 'mock' || a.thermal?.thermal_source === 'mock';

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const allowMock = ALLOW_MOCK || url.searchParams.get('allow_mock') === 'true';

  if (SLOW) await sleep(SLOW);

  // After /pod/shutdown the pod is simply gone. Restart this script to switch it on.
  if (podOff) {
    console.log(`  · ${path} - pod is off`);
    return res.destroy();
  }

  // Contract §6.6 — the boot window, with the Retry-After the client honours.
  if (BOOTING && Date.now() - STARTED < BOOTING * 1000) {
    console.log(`  · ${path} — still booting`);
    return send(res, 503, { error: 'not_ready' }, { 'Retry-After': '5' });
  }

  // The AP is down while the pod is talking to the mast. Not an error the pod
  // can report — it is simply not there — so the socket is closed.
  //
  // `sync/status` and `sync/trigger` are exempt, for different reasons.
  // `status` is how a client watches the window from the outside. `trigger` is
  // exempt so that the 409 the contract documents is actually reachable in
  // testing: a failure path nobody has ever seen fire is a failure path that
  // does not work, and this is the only way to exercise the client's handler
  // for it.
  const exemptWhileSyncing = path === '/api/v1/sync/status' || path === '/api/v1/sync/trigger';
  if (isSyncing() && !exemptWhileSyncing) {
    console.log(`  · ${path} — AP down, pod is on the mast network`);
    return res.destroy();
  }

  if (FLAKY && Math.random() < 0.33 && path.startsWith('/api/v1/advisory/')) {
    console.log(`  ✗ ${path} — simulated failure`);
    return send(res, 503, { error: 'not_ready' }, { 'Retry-After': '1' });
  }

  console.log(`  → ${req.method} ${path}${url.search}`);

  // ---- health -------------------------------------------------------------
  if (path === '/api/v1/health') {
    const latest = advisories[advisories.length - 1];
    return send(res, 200, {
      device: 'sih-pod-01',
      schema_version: '1.0',
      server_time_utc: nowUtc(),
      gps_time_valid: !NO_GPS,
      clock_source: NO_GPS ? (scan ? 'phone' : 'filesystem') : 'gps',
      pod_ready: podReady(),
      scan_state: scanBusy() ? scan.state : 'idle',
      storage: { location: 'sd', free_mb: 46210 },
      advisory_count: advisories.length,
      latest_seq: latest?.seq ?? 0,
      storage_free_kb: 29847,
      syncing: isSyncing(),
      sync_state: isSyncing() ? 'STA_SYNC' : 'IDLE',
    });
  }

  // ---- manifest -----------------------------------------------------------
  if (path === '/api/v1/manifest') {
    const sinceRaw = url.searchParams.get('since');
    const limitRaw = url.searchParams.get('limit');

    // Cursor semantics: exclusive, ascending, ordered by seq. An integer is the
    // real cursor; an advisory_id string is accepted and resolved, as a
    // courtesy to a client that has not migrated yet.
    let since = 0;
    if (sinceRaw !== null && sinceRaw !== '') {
      if (/^\d+$/.test(sinceRaw)) {
        since = Number(sinceRaw);
      } else {
        const match = advisories.find((a) => a.advisory_id === sinceRaw);
        if (!match) {
          return send(res, 400, { error: 'bad_request', detail: `unknown since ${sinceRaw}` });
        }
        since = match.seq ?? 0;
      }
    }

    let limit = 200;
    if (limitRaw !== null) {
      if (!/^\d+$/.test(limitRaw)) {
        return send(res, 400, { error: 'bad_request', detail: 'limit must be an integer' });
      }
      if (Number(limitRaw) < 1) {
        return send(res, 400, { error: 'bad_request', detail: 'limit must be >= 1' });
      }
      limit = Math.min(Number(limitRaw), 500);
    }

    // Contract §3.1: mock advisories are filtered out of the manifest entirely
    // in production mode, rather than listed and then refused.
    const visible = advisories.filter((a) => allowMock || !isMock(a));
    const matching = visible.filter((a) => (a.seq ?? 0) > since);
    const slice = matching.slice(0, limit);

    return send(res, 200, {
      schema_version: '1.0',
      count: slice.length,
      advisories: slice.map((a) => ({
        advisory_id: a.advisory_id,
        seq: a.seq,
        generated_at_utc: a.generated_at_utc,
        bytes: Buffer.byteLength(JSON.stringify(a)),
        replay: a.replay !== false,
        inference_backend: a.inference_backend,
      })),
      truncated: matching.length > slice.length,
    });
  }

  // ---- advisory -----------------------------------------------------------
  if (path === '/api/v1/advisory/latest') {
    advanceScan();
    const visible = advisories.filter((a) => allowMock || !isMock(a));
    const found = visible[visible.length - 1];
    if (!found) return send(res, 404, { error: 'not_found', advisory_id: 'latest' });
    return send(res, 200, found, { 'x-aegis-simulated': 'true' });
  }

  if (path.startsWith('/api/v1/advisory/')) {
    advanceScan();
    const key = decodeURIComponent(path.slice('/api/v1/advisory/'.length));
    // Resolvable by advisory_id string or by integer sequence number.
    const found = /^\d+$/.test(key)
      ? advisories.find((a) => a.seq === Number(key))
      : advisories.find((a) => a.advisory_id === key);

    if (!found) return send(res, 404, { error: 'not_found', advisory_id: key });

    if (isMock(found) && !allowMock) {
      return send(res, 403, {
        error: 'mock_advisory_rejected',
        detail: 'Gateway running in production mode rejecting mock advisory',
      });
    }

    // The header that keeps the app honest about what it just received.
    return send(res, 200, found, { 'x-aegis-simulated': 'true' });
  }

  // ---- ack ----------------------------------------------------------------
  if (path === '/api/v1/ack' && req.method === 'POST') {
    if (!req.headers['content-length']) {
      return send(res, 400, { error: 'bad_request', detail: 'Missing Content-Length header' });
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      return send(res, 400, { error: 'bad_request', detail: `Malformed JSON: ${err.message}` });
    }
    if (parsed.upto === undefined && parsed.advisory_id === undefined) {
      return send(res, 400, {
        error: 'bad_request',
        detail: "Missing 'upto' or 'advisory_id' field in payload",
      });
    }
    const acknowledged =
      parsed.upto !== undefined
        ? Number(parsed.upto)
        : (advisories.find((a) => a.advisory_id === parsed.advisory_id)?.seq ?? acked);
    acked = Number.isFinite(acknowledged) ? acknowledged : acked;
    console.log(`  ✓ cursor acknowledged up to ${acked}`);
    return send(res, 200, { status: 'ok', acked: parsed.advisory_id ?? acked });
  }

  // ---- mast sync ----------------------------------------------------------
  if (path === '/api/v1/sync/status') {
    return send(res, 200, {
      sync_in_progress: isSyncing(),
      last_success_utc: mast.last_success_utc,
      last_attempt_utc: mast.last_attempt_utc,
      last_result: mast.last_result,
      mast_data_age_s: mast.mast_data_age_s,
      records_pulled: mast.records_pulled,
      trap_images_pulled: mast.trap_images_pulled,
    });
  }

  if (path === '/api/v1/sync/trigger' && req.method === 'POST') {
    if (isSyncing()) {
      return send(res, 409, {
        error: 'sync_in_progress',
        detail: 'Mast synchronization is already running',
      });
    }
    const downtime = 30;
    mast.syncing = true;
    mast.syncUntil = Date.now() + downtime * 1000;
    mast.last_attempt_utc = nowUtc();
    console.log(`  ⇄ dropping the AP for ${downtime}s to collect from the mast`);

    setTimeout(() => {
      mast.syncing = false;
      if (NO_MAST) {
        mast.last_result = 'MAST_NOT_FOUND';
        console.log('  ✗ mast not found');
        return;
      }
      mast.last_result = 'OK';
      mast.last_success_utc = nowUtc();
      mast.records_pulled = 48;
      mast.trap_images_pulled = 1;
      mast.mast_data_age_s = 120;
      console.log('  ✓ mast collected, AP back up');
    }, downtime * 1000);

    return send(res, 202, {
      status: 'accepted',
      timestamp: nowUtc(),
      expected_ap_downtime_s: downtime,
    });
  }

  // ---- trap upload --------------------------------------------------------
  if (path === '/api/v1/trap/upload' && req.method === 'POST') {
    const trapId = url.searchParams.get('trap_id') ?? req.headers['x-trap-id'] ?? 'TRAP_01';
    const days = Number(url.searchParams.get('days') ?? req.headers['x-days-monitored'] ?? 0);
    const scale = url.searchParams.get('scale') ?? req.headers['x-scale'] ?? null;
    const allowProvisional =
      url.searchParams.get('allow_provisional') === 'true' ||
      req.headers['x-allow-provisional'] === 'true';

    // Drain the body so the socket does not stall, then discard it — this
    // simulator does not segment anything.
    let bytes = 0;
    for await (const chunk of req) bytes += chunk.length;

    if (!days || days < 1 || days > 7) {
      return send(res, 400, {
        error: 'bad_request',
        detail: 'days must be between 1 and 7 (INVALID_MONITORING_WINDOW)',
      });
    }

    // Contract §6.1: without a measurable scale the pod refuses rather than
    // guessing, unless the caller explicitly accepts a provisional one.
    if (scale === null && !allowProvisional) {
      return send(res, 400, {
        error: 'scale_uncalibrated',
        detail: 'No scale marker found on the card and allow_provisional was not set',
      });
    }

    const blobs = 40 + Math.floor(Math.random() * 130);
    console.log(`  ✓ trap ${trapId}: ${bytes} bytes, ${blobs} blobs`);

    return send(res, 200, {
      status: 'ok',
      job_id: `job_${Date.now().toString(36)}`,
      trap_id: trapId,
      record_id: 1 + Math.floor(Math.random() * 100),
      advisory_id: advisories[advisories.length - 1]?.advisory_id ?? null,
      total_blobs_counted: blobs,
      scale_status: scale === null ? 'PROVISIONAL' : 'CALIBRATED',
      scale_mm_per_pixel: scale === null ? null : Number(scale),
      etl_status: blobs > 100 ? 'ABOVE_ETL' : blobs === 100 ? 'AT_ETL' : 'BELOW_ETL',
      pest: [
        {
          target_pest_context: 'sugarcane_whitefly_woolly_aphid',
          count_basis: 'watershed_all_blobs',
          count_observed: blobs,
          days_monitored: days,
          daily_rate: Number((blobs / days).toFixed(1)),
          threshold_value: 100.0,
          threshold_unit: 'insects_per_trap',
          threshold_available: true,
          status: blobs > 100 ? 'ABOVE_ETL' : blobs === 100 ? 'AT_ETL' : 'BELOW_ETL',
          threshold_verification_status: 'VERIFIED',
          classification_verification_status: 'RECALLED_UNVERIFIED',
          total_blobs_counted: blobs,
          classification_source: 'CROSS_DOMAIN_PRETRAINED',
        },
      ],
    });
  }

  // ---- scan control -------------------------------------------------------
  if (path === '/api/v1/scan/start' && req.method === 'POST') {
    const parsed = await readJson(req);
    if (!parsed.ok) return send(res, 400, { error: 'bad_request', detail: parsed.detail });
    const { field_id: fieldId, crop, phone_utc: phoneUtc, source } = parsed.value;
    advanceScan();
    if (scanBusy()) return send(res, 409, { error: 'scan_in_progress', scan_id: scan.scanId });
    if (!fieldId) return send(res, 400, { error: 'bad_request', detail: 'field_id is required' });
    if (!DISEASE_BY_CROP[crop]) {
      return send(res, 400, { error: 'bad_request', detail: `unknown crop ${JSON.stringify(crop)}` });
    }
    if (!podReady()) return send(res, 503, { error: 'not_ready' }, { 'Retry-After': '5' });
    if (NO_CAMERA && source !== 'replay') return send(res, 503, { error: 'camera_unavailable' });
    const startedAt = Date.now();
    scan = {
      scanId: `${isoAt(startedAt)}_${fieldId}`,
      fieldId,
      crop,
      replay: source === 'replay',
      state: 'starting',
      startedAt,
      fixes: [],
      captures: [],
      captureBusy: false,
    };
    console.log(`  ▶ scan ${scan.scanId} (${crop}${scan.replay ? ', replay' : ''}), phone time ${phoneUtc}`);
    return send(res, 202, { scan_id: scan.scanId, state: 'starting', replay: scan.replay });
  }

  if (path === '/api/v1/scan/status') return send(res, 200, scanStatus());

  if (path === '/api/v1/scan/track' && req.method === 'POST') {
    const parsed = await readJson(req);
    if (!parsed.ok) return send(res, 400, { error: 'bad_request', detail: parsed.detail });
    advanceScan();
    if (!scan || parsed.value.scan_id !== scan.scanId || !scanBusy()) {
      return send(res, 409, { error: 'no_such_scan' });
    }
    const fixes = Array.isArray(parsed.value.fixes) ? parsed.value.fixes : [];
    const bad = fixes.find(
      (f) => typeof f.lat !== 'number' || typeof f.lon !== 'number' || typeof f.accuracy_m !== 'number' || !f.utc,
    );
    if (bad) return send(res, 400, { error: 'bad_request', detail: `bad fix ${JSON.stringify(bad)}` });
    scan.fixes.push(...fixes);
    console.log(`  ⌖ ${fixes.length} fixes (${scan.fixes.length} held)`);
    return send(res, 200, { accepted: fixes.length });
  }

  if (path === '/api/v1/camera/frame.jpg') {
    advanceScan();
    if (!scan || !['starting', 'scanning'].includes(scan.state)) return send(res, 409, { error: 'camera_idle' });
    if (NO_CAMERA && !scan.replay) return send(res, 503, { error: 'camera_unavailable' });
    const frame = previewFrame();
    if (!frame) {
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      return res.end();
    }
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': frame.jpeg.length,
      'Cache-Control': 'no-store',
      'X-Frame-Seq': String(frame.seq),
      'X-Frame-UTC': isoAt(frame.atMs),
      'X-Frame-Source': scan.replay ? 'replay' : 'camera',
      'x-aegis-simulated': 'true',
    });
    return res.end(frame.jpeg);
  }

  if (path === '/api/v1/scan/capture' && req.method === 'POST') {
    const parsed = await readJson(req);
    if (!parsed.ok) return send(res, 400, { error: 'bad_request', detail: parsed.detail });
    advanceScan();
    if (!scan || parsed.value.scan_id !== scan.scanId) return send(res, 404, { error: 'no_such_scan' });
    if (scan.state !== 'scanning') return send(res, 409, { error: 'not_scanning' });
    if (NO_CAMERA && !scan.replay) return send(res, 503, { error: 'camera_unavailable' });
    if (scan.captureBusy) return send(res, 429, { error: 'capture_busy' });
    scan.captureBusy = true;
    try {
      // The real pod classifies a full-resolution frame here; a second is fair.
      await sleep(900);
      const capture = takeCapture();
      console.log(`  📷 capture ${capture.capture_id}: ${capture.verdict}${capture.top_class ? ` ${capture.top_class}` : ''}`);
      return send(res, 200, capture, { 'x-aegis-simulated': 'true' });
    } finally {
      scan.captureBusy = false;
    }
  }

  if (path === '/api/v1/scan/stop' && req.method === 'POST') {
    const parsed = await readJson(req);
    if (!parsed.ok) return send(res, 400, { error: 'bad_request', detail: parsed.detail });
    if (!scan || parsed.value.scan_id !== scan.scanId) return send(res, 404, { error: 'no_such_scan' });
    advanceScan();
    if (scan.state === 'finalizing' || scan.state === 'done') return send(res, 200, { state: scan.state });
    beginFinalizing('user');
    return send(res, 202, { state: 'finalizing' });
  }

  if (path === '/api/v1/pod/shutdown' && req.method === 'POST') {
    const parsed = await readJson(req);
    if (!parsed.ok || parsed.value.confirm !== true) {
      return send(res, 400, { error: 'bad_request', detail: 'confirm must be true' });
    }
    advanceScan();
    const busy = scanBusy();
    if (busy) beginFinalizing('user');
    console.log('  ⏻ shutting down in 5s. Restart this script to switch the pod on.');
    setTimeout(() => {
      podOff = true;
    }, 5000 + (busy ? FINALIZE_S * 1000 : 0));
    return send(res, 202, { shutting_down_in_s: 5 });
  }

  // ---- media --------------------------------------------------------------
  // Contract §6.5: always gone. Raw captures are retention-pruned, which is why
  // every `media_ids` on the wire is an empty array.
  if (path.startsWith('/api/v1/media/')) {
    const id = decodeURIComponent(path.slice('/api/v1/media/'.length));
    const jpeg = capturedMedia.get(id);
    if (jpeg) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': jpeg.length, 'x-aegis-simulated': 'true' });
      return res.end(jpeg);
    }
    return send(res, 410, { error: 'gone', reason: 'retention_pruned' });
  }

  send(res, 404, { error: 'not_found', path });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nFake pod gateway on http://0.0.0.0:${PORT}`);
  console.log(`  serving ${advisories.length} advisories, all marked simulated`);
  console.log(`  production mock guard: ${ALLOW_MOCK ? 'OFF (--allow-mock)' : 'ON'}`);
  if (FLAKY) console.log('  --flaky: ~1 in 3 advisory fetches will fail');
  if (SLOW) console.log(`  --slow: ${SLOW}ms per response`);
  if (BOOTING) console.log(`  --booting: 503 with Retry-After for ${BOOTING}s`);
  if (NO_MAST) console.log('  --no-mast: mast sync will report MAST_NOT_FOUND');
  if (NOT_READY) console.log(`  --not-ready: pod_ready is false for ${NOT_READY}s`);
  if (NO_CAMERA) console.log('  --no-camera: starting a camera scan answers 503');
  if (NO_STATION) console.log('  --no-station: field station not found on every scan');
  if (NO_GPS) console.log('  --no-gps: pod clock is "filesystem" until a scan adopts the phone time');
  console.log(`  scans: ${STRETCH_S}s per stretch, ${FINALIZE_S}s to finalize, ${MAX_S}s limit`);
  console.log('\nPoint the app at this address on the pod screen.');
  console.log("On a physical phone use this machine's LAN IP, not 192.168.4.1.\n");
});
