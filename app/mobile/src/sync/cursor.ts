/**
 * Cursor arithmetic, kept pure so it can be tested.
 *
 * Deliberately free of database and React Native imports: the decision below is
 * the part of the sync that can be *silently* wrong, and a decision that cannot
 * be unit-tested is a decision nobody checks. The rest of `client.ts` needs a
 * socket and a SQLite handle; this needs neither.
 */

/** Just the part of `/health` this decision reads. */
export type CursorHealth = {
  /** The pod's own high-water mark: the largest `seq` it currently holds. */
  latest_seq?: number;
};

/**
 * Has the pod's database restarted since we last spoke to it?
 *
 * ── The failure this prevents ───────────────────────────────────────────────
 * The sync cursor is `seq` — the pod's SQLite rowid. It is monotonic, assigned
 * at commit, and never reused, which is exactly what makes it a safe cursor
 * while the database lives.
 *
 * **It restarts at 1 when that database is wiped or the device is reflashed.**
 *
 * The phone's cursor does not restart. So after a reflash the phone asks for
 * everything after seq 95, the pod's newest record is seq 3, and the manifest
 * comes back empty. Not an error — an empty list is a perfectly ordinary
 * answer meaning "nothing new". The sync reports success, fetches nothing, and
 * does so again on every subsequent attempt, forever. The farmer's history
 * silently stops growing and no screen anywhere says why.
 *
 * That is the worst shape a bug can take in this app: no crash, no error, no
 * symptom except an absence that looks exactly like a quiet week in the field.
 * On a build that gets reflashed as often as this one, it is a when, not an if.
 *
 * ── The detection ───────────────────────────────────────────────────────────
 * `latest_seq` is the pod's own high-water mark. Under normal operation it only
 * ever grows, and it is always >= any cursor we could have got from it. Pruning
 * old advisories cannot lower it either, because pruning removes the oldest
 * records and `latest_seq` tracks the newest.
 *
 * So `latest_seq < cursor` has exactly one meaning: the numbering restarted.
 *
 * It also fires when the phone is pointed at a *different* pod that happens to
 * be further behind — which wants the same response, so that is a feature
 * rather than a false positive.
 *
 * ── Why rewinding is safe ───────────────────────────────────────────────────
 * Ingest is an upsert keyed on `advisory_id`, and the manifest is filtered
 * against what the replica already holds. Re-pulling costs a few seconds and
 * changes nothing. Nothing is deleted from the phone: advisories the pod no
 * longer has are still the farmer's history, and they stay.
 */
export function podHasRestarted(
  health: CursorHealth | null | undefined,
  cursor: number | null,
): boolean {
  if (!health || typeof health.latest_seq !== 'number') return false;
  // Nothing to compare against. A phone that has never synced cannot be ahead.
  if (cursor === null) return false;
  return health.latest_seq < cursor;
}

/**
 * Where to rewind to.
 *
 * Zero rather than null. Both mean "from the beginning" to the manifest, but a
 * stored 0 also records that this phone has synced before, which the fixture
 * seeding reads (`seed.ts`) to keep a deliberately cleared replica cleared.
 */
export const REWIND_TO = 0;

/** Just the part of a manifest entry the cursor decision reads. */
export type CursorEntry = {
  advisory_id: string;
  seq: number;
};

/**
 * How far the cursor may move after a pull.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 * The cursor means "the phone holds everything up to here". The next manifest
 * starts strictly after it, so anything below the cursor that the phone does
 * not hold is never offered again. The cursor may therefore only advance
 * through an unbroken run of settled records, and stops at the first one that
 * is not.
 *
 * "Settled" means the phone holds it. A record the pod listed but failed to
 * serve — a 404 included — is never settled: the pod's own manifest says it
 * exists, so a failed fetch is a gap to retry, not a record to step over.
 *
 * ── The failure this prevents ───────────────────────────────────────────────
 * "Just get the newest scan" stores seq 7 without walking the manifest. The
 * old rule jumped to the highest seq the phone held, so the next full pull
 * asked for `since=7` and seqs 1–6 were never pulled. The same rule let one
 * failed fetch of seq 1 save a cursor of 7, because 7 was already held. Both
 * cases skip records permanently and still report the sync as a success.
 */
export function advanceCursor(
  start: number | null,
  listed: readonly CursorEntry[],
  settled: ReadonlySet<string>,
): number | null {
  let cursor = start;
  const ordered = listed
    .filter((e) => typeof e.seq === 'number')
    .sort((a, b) => a.seq - b.seq);
  for (const entry of ordered) {
    if (!settled.has(entry.advisory_id)) break;
    if (cursor === null || entry.seq > cursor) cursor = entry.seq;
  }
  return cursor;
}
