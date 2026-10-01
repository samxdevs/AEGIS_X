/**
 * Loads the shipped fixtures into the replica on first launch.
 *
 * The app must render a full history with no pod present — that had to work
 * before any networking did, and it matters more than usual right now, because
 * the SIH-FIELD access point is still waiting on a replacement WiFi dongle and
 * nobody has yet held this phone next to a live pod.
 *
 * Five of these six are invented, so they go in with origin 'fixture' and every
 * screen that shows one says SAMPLE DATA. They are chosen for their failure
 * states rather than their happy path, because degraded rendering is the part
 * that gets skipped when a demo is built happy-path-first — and on this system
 * the degraded states are not edge cases, they are Tuesday:
 *
 *   healthy          everything available: CWSI computed, satellite scene
 *                    cached, irrigation from the mast, trap under the limit
 *   failed-tier      bacterial leaf blight at 0.98 confidence on a class that
 *                    scores 0.00% recall on held-out cameras. The single most
 *                    important thing this UI has to render correctly
 *   recalled-dose    a RECALLED_UNVERIFIED sugarcane dose that must not render
 *                    like a registered one, plus a bare-soil scan where every
 *                    vegetation index is legitimately withheld
 *   trap-above-etl   over the published ETL, alongside a pest a sticky card is
 *                    the wrong instrument for and one with no published limit
 *   uncertain        the pod declining to call it, on the ONNX fallback engine
 *
 * The sixth is not invented. `advisory-device-capture.json` is the advisory the
 * hardware team captured from the Jetson Nano on 19 September, byte for byte.
 * It is here so the validator and every renderer are exercised against reality
 * rather than against our idea of it — it is the fixture that catches us
 * flagging a real advisory as broken, and it is the one that carries
 * MULTIPLE_CROPS_DETECTED, a `growth_stage.status` the contract's own enum does
 * not list, and an `irrigation` block of exactly two keys.
 */

import { ingestAdvisory, countAdvisories, deleteFixtures } from './advisories.ts';
import { getState, setState } from './client.ts';

import healthy from '../../fixtures/advisory-healthy.json';
import failedTier from '../../fixtures/advisory-failed-tier.json';
import recalledDose from '../../fixtures/advisory-recalled-dose.json';
import trapAboveEtl from '../../fixtures/advisory-trap-above-etl.json';
import uncertain from '../../fixtures/advisory-uncertain.json';
import deviceCapture from '../../fixtures/advisory-device-capture.json';

const FIXTURES: unknown[] = [
  deviceCapture,
  healthy,
  failedTier,
  recalledDose,
  trapAboveEtl,
  uncertain,
];

/**
 * Bump this whenever the fixture set changes shape.
 *
 * It exists because of a real crash. The fixtures were rewritten for the
 * handheld-pod schema, but `seedFixturesIfEmpty` only ever ran on an empty
 * replica — so a phone that already had the old drone-era fixtures kept them,
 * the advisory screen read `crop_health` off a record that had never heard of
 * it, and the app died on open. Moving to wire contract v1.0 is the same
 * hazard again: the `water` block these fixtures used to carry no longer
 * exists, and a replica holding the old ones would render nothing.
 *
 * Sample data is not evidence of anything, so replacing it wholesale is safe in
 * a way that discarding a synced record would not be. Only fixture-origin rows
 * are touched; a real advisory is never removed by this.
 */
const FIXTURE_VERSION = '2026-09-28-farmland-gps';

/** Stored in place of a version once the samples were taken out on purpose. */
const FIXTURES_REMOVED = 'removed';

/**
 * Seeds the fixtures, and replaces them when they go stale.
 *
 * Safe to call on every launch. A real synced advisory is never overwritten by
 * sample data, and a replica that has been deliberately cleared stays cleared.
 */
export async function seedFixturesIfEmpty(): Promise<number> {
  const seeded = await getState('fixtures_version');

  // Removed from the pod screen. Stays removed until reloaded from there, or
  // until the replica is cleared.
  if (seeded === FIXTURES_REMOVED) return 0;

  // The fixtures changed under a replica that already holds the old ones.
  // Swap them rather than leaving a record the current renderer cannot read.
  if (seeded !== null && seeded !== FIXTURE_VERSION) {
    await deleteFixtures();
    const n = await insertFixtures();
    await setState('fixtures_version', FIXTURE_VERSION);
    return n;
  }

  if ((await countAdvisories()) > 0) return 0;
  if ((await getState('cursor')) !== null) return 0; // synced before, then cleared

  const n = await insertFixtures();
  await setState('fixtures_version', FIXTURE_VERSION);
  await setState('last_sync_error', null);
  return n;
}

async function insertFixtures(): Promise<number> {
  for (const f of FIXTURES) await ingestAdvisory(f, { origin: 'fixture' });
  return FIXTURES.length;
}

/**
 * Demo affordance: take the sample advisories out, leaving every real one.
 * Recorded, so the next launch does not seed them straight back in.
 */
export async function removeFixtures(): Promise<number> {
  const n = await deleteFixtures();
  await setState('fixtures_version', FIXTURES_REMOVED);
  return n;
}

/** Demo affordance: force the fixtures back in after a reset. */
export async function reseedFixtures(): Promise<number> {
  await deleteFixtures();
  const n = await insertFixtures();
  await setState('fixtures_version', FIXTURE_VERSION);
  return n;
}
