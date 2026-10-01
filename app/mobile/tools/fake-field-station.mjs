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

const STARTED = Date.now();
const FIXTURE_DIR = fileURLToPath(new URL('../fixtures/', import.meta.url).href);

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
      gps_time_valid: true,
      clock_source: 'gps',
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
    const visible = advisories.filter((a) => allowMock || !isMock(a));
    const found = visible[visible.length - 1];
    if (!found) return send(res, 404, { error: 'not_found', advisory_id: 'latest' });
    return send(res, 200, found, { 'x-aegis-simulated': 'true' });
  }

  if (path.startsWith('/api/v1/advisory/')) {
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

  // ---- media --------------------------------------------------------------
  // Contract §6.5: always gone. Raw captures are retention-pruned, which is why
  // every `media_ids` on the wire is an empty array.
  if (path.startsWith('/api/v1/media/')) {
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
  console.log('\nPoint the app at this address on the pod screen.');
  console.log("On a physical phone use this machine's LAN IP, not 192.168.4.1.\n");
});
