/**
 * The restart check, tested because its failure mode is silence.
 *
 * Everything else in the sync fails loudly — a socket times out, a status code
 * comes back wrong, a schema rule fires. This one fails by reporting success
 * while fetching nothing, on every attempt, forever. There is no symptom to
 * notice and nothing on any screen to read.
 *
 * So the two directions are tested separately and deliberately: it must fire
 * when the pod really has restarted, and it must *not* fire in any of the
 * ordinary situations that superficially resemble it. A check that fires on a
 * normal sync would re-pull the entire history every time and never settle.
 *
 *   npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { REWIND_TO, advanceCursor, podHasRestarted } from './cursor.ts';

// ---- It must fire ---------------------------------------------------------

test('fires when the pod is behind the cursor', () => {
  // The whole point: phone at 95, reflashed pod back down at 3.
  assert.equal(podHasRestarted({ latest_seq: 3 }, 95), true);
});

test('fires when the pod has been wiped completely', () => {
  // An empty pod reports 0. Without this the phone would ask for everything
  // after 95 forever and never notice the database underneath it was emptied.
  assert.equal(podHasRestarted({ latest_seq: 0 }, 95), true);
});

test('fires one step behind, not just far behind', () => {
  // No tolerance band. `latest_seq` cannot legitimately go backwards at all,
  // so a single step back is already the thing this is looking for.
  assert.equal(podHasRestarted({ latest_seq: 94 }, 95), true);
});

// ---- It must not fire -----------------------------------------------------

test('does not fire on an ordinary sync with nothing new', () => {
  // The most common call by far: phone and pod level with each other. This
  // must be cheap and must not rewind, or every quiet sync re-pulls the lot.
  assert.equal(podHasRestarted({ latest_seq: 95 }, 95), false);
});

test('does not fire when the pod is ahead, which is the normal case', () => {
  assert.equal(podHasRestarted({ latest_seq: 120 }, 95), false);
});

test('does not fire on a phone that has never synced', () => {
  // No cursor means nothing to be ahead of. A fresh install pulls everything
  // anyway, so claiming a reset here would be noise.
  assert.equal(podHasRestarted({ latest_seq: 0 }, null), false);
  assert.equal(podHasRestarted({ latest_seq: 42 }, null), false);
});

test('does not fire when the pod did not report its high-water mark', () => {
  // An older pod, or a truncated response. Unknown is not the same as behind,
  // and guessing here would wipe the cursor on the strength of a missing field.
  assert.equal(podHasRestarted({}, 95), false);
  assert.equal(podHasRestarted({ latest_seq: undefined }, 95), false);
});

test('does not fire when health could not be fetched at all', () => {
  // `probeHealth` is allowed to fail without failing the sync, so this is
  // reachable on any run where the pod answered the manifest but not /health.
  assert.equal(podHasRestarted(null, 95), false);
  assert.equal(podHasRestarted(undefined, 95), false);
});

test('a non-numeric latest_seq is ignored rather than coerced', () => {
  // "95" < 95 is false in JS but "3" < 95 is true, so a pod sending strings
  // would fire intermittently. Type-check first, compare second.
  assert.equal(podHasRestarted({ latest_seq: '3' } as never, 95), false);
});

// ---- Where it rewinds to --------------------------------------------------

test('rewinding lands on zero, not on null', () => {
  // Both pull from the beginning, but a stored 0 also records that this phone
  // has synced before, which keeps a cleared replica from being re-seeded.
  assert.equal(REWIND_TO, 0);
});

test('the rewind target immediately stops the check firing again', () => {
  // The condition has to settle on the very next call, including against a pod
  // that is still empty. Otherwise every sync rewinds and re-pulls for ever.
  assert.equal(podHasRestarted({ latest_seq: 0 }, REWIND_TO), false);
  assert.equal(podHasRestarted({ latest_seq: 3 }, REWIND_TO), false);
});

// ---- How far the cursor advances ------------------------------------------

const seqs = (...ns: number[]) => ns.map((n) => ({ advisory_id: `A${n}`, seq: n }));
const held = (...ns: number[]) => new Set(ns.map((n) => `A${n}`));

test('newest scan pulled alone: the next full pull does not start after it', () => {
  // The bug from the Nano log. "Just get the newest scan" stored seq 7 and the
  // following pull asked for since=7, so 1-6 never came across. With 1-6
  // listed and not yet held, the cursor must not move at all.
  assert.equal(advanceCursor(null, seqs(1, 2, 3, 4, 5, 6, 7), held(7)), null);
});

test('once the gap is filled, it advances past the record already held', () => {
  assert.equal(advanceCursor(null, seqs(1, 2, 3, 4, 5, 6, 7), held(1, 2, 3, 4, 5, 6, 7)), 7);
});

test('a failed fetch stops the cursor below it, even when later records are held', () => {
  // Fetching seq 3 failed. Seq 7 is held, but saving 7 would drop 3-6 for good.
  assert.equal(advanceCursor(0, seqs(1, 2, 3, 4, 5, 6, 7), held(1, 2, 7)), 2);
});

test('failing on the very first record leaves the cursor where it started', () => {
  assert.equal(advanceCursor(null, seqs(1, 2, 7), held(7)), null);
  assert.equal(advanceCursor(4, seqs(5, 6, 7), held(7)), 4);
});

test('gaps in the pod numbering do not block the cursor', () => {
  // seq is never reused, so pruned or rolled-back rows leave gaps. Only listed
  // records count; a missing number is not a missing record.
  assert.equal(advanceCursor(0, seqs(2, 5, 9), held(2, 5, 9)), 9);
});

test('never moves backwards, and ignores listing order', () => {
  assert.equal(advanceCursor(10, [], held()), 10);
  assert.equal(advanceCursor(null, seqs(3, 1, 2), held(1, 2, 3)), 3);
});
