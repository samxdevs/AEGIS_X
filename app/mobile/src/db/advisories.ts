/**
 * Reading and writing advisories in the replica.
 *
 * Ingest is the one place an advisory enters the app, and it is where the
 * validator runs. Everything downstream can assume it knows whether the record
 * it is holding is trustworthy, because the answer is stored beside it.
 */

import type { Advisory, CropHealthState, InferenceBackend } from '../schema/advisory.ts';
import { fieldIdFromAdvisoryId, isReplay } from '../schema/advisory.ts';
import type { Violation } from '../schema/validate.ts';
import { validateAdvisory } from '../schema/validate.ts';
import { getDb } from './client.ts';

/**
 * Where a stored advisory came from. These are four different claims about
 * reality and the UI must not merge them: a judge who sees unlabelled sample
 * data has found the project's own worst failure mode inside the demo.
 */
export type AdvisoryOrigin = 'synced' | 'replay' | 'fixture' | 'imported';

/** An advisory as the app handles it: the payload plus what we know about it. */
export type StoredAdvisory = {
  advisory: Advisory;
  valid: boolean;
  violations: Violation[];
  origin: AdvisoryOrigin;
  receivedAtUtc: string;
};

/** The listing row — enough to render a card without parsing the full JSON. */
export type AdvisorySummary = {
  advisoryId: string;
  seq: number | null;
  /** Parsed off the advisory_id suffix when it has one. Display only. */
  fieldId: string | null;
  generatedAtUtc: string;
  valid: boolean;
  violationCount: number;
  origin: AdvisoryOrigin;
  /**
   * The verdict, lifted out for the list. Null on a record too malformed to
   * carry one — which is itself worth seeing in the list rather than only after
   * tapping through.
   */
  state: CropHealthState | null;
  /** The crop the scan settled on, or null when it could not pick one. */
  crop: string | null;
  /**
   * The leading finding, for the row headline. Contract v1.0 dropped
   * `crop_health.class`, so this is the highest-confidence entry in
   * `disease[]` — which is what that field used to hold anyway.
   */
  topClass: string | null;
  inferenceBackend: InferenceBackend | null;
  /** The raw stamp, before it was resolved into `origin`. */
  replay: boolean;
};

type Row = {
  advisory_id: string;
  seq: number | null;
  field_id: string;
  generated_at_utc: string;
  schema_version: string;
  json: string;
  valid: number;
  violations: string | null;
  origin: AdvisoryOrigin;
  received_at_utc: string;
  inference_backend: string | null;
  replay: number | null;
};

/**
 * Ordering, in one place: newest first by the date on the card.
 *
 * Not by `seq`. It is the pod's commit order, so it only orders records that
 * came from one pod's database. The sample fixtures carry seqs in the 90s, a
 * freshly flashed pod starts again at 1, and ordering by seq put a synced
 * 25 Sep advisory below 20 Sep samples. The list has to match the dates it
 * prints. `seq` breaks ties between records stamped in the same second.
 *
 * The cost: before a GPS fix the pod's clock can be wrong, and a record it
 * stamps then sorts by that wrong date. The card shows the same date, so the
 * order at least agrees with what the farmer reads.
 */
const ORDER = 'ORDER BY generated_at_utc DESC, seq DESC';

const COLUMNS =
  'advisory_id, seq, field_id, generated_at_utc, schema_version, json, ' +
  'valid, violations, origin, received_at_utc, inference_backend, replay';

/**
 * The strongest finding in an advisory, for the listing row.
 *
 * `disease[]` is ordered by the pod but not guaranteed to be, so this picks by
 * confidence rather than trusting position. Returns null on an empty list,
 * which is the normal case for a healthy scan and must not be confused with a
 * missing block.
 */
export function topFinding(advisory: Advisory | undefined): string | null {
  const disease = advisory?.disease;
  if (!Array.isArray(disease) || disease.length === 0) return null;
  return disease.reduce((a, b) => (b.confidence > a.confidence ? b : a)).class ?? null;
}

/**
 * Stores one advisory, validating it on the way in.
 *
 * A failing advisory is stored with its violations rather than rejected. The
 * app is the last place a fabricated number can be caught — catching it and
 * then throwing the evidence away would defeat the point. The renderer shows
 * the violations; it does not pretend the record is fine.
 */
export async function ingestAdvisory(
  raw: unknown,
  opts: { origin?: AdvisoryOrigin } = {},
): Promise<{ advisoryId: string; valid: boolean; violations: Violation[] }> {
  const { ok, violations } = validateAdvisory(raw);
  const a = raw as Advisory;

  if (!a?.advisory_id) {
    throw new Error('advisory has no advisory_id, so it cannot be stored or acknowledged');
  }

  /**
   * Provenance, resolved the safe way round.
   *
   * `isReplay` treats a *missing* replay field as true, not false. The failure
   * worth guarding against is a seeded record labelled live, not a live record
   * labelled seeded — so if the pod ever ships a bug that drops the field, the
   * app under-claims rather than over-claims. An explicit caller-supplied
   * origin still wins, because a fixture knows what it is.
   */
  const replay = isReplay(a);
  const origin: AdvisoryOrigin = opts.origin ?? (replay ? 'replay' : 'synced');
  const db = await getDb();

  await db.runAsync(
    `INSERT INTO advisories
       (advisory_id, seq, field_id, generated_at_utc, schema_version, json,
        valid, violations, origin, received_at_utc, inference_backend, replay)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(advisory_id) DO UPDATE SET
       seq = excluded.seq,
       json = excluded.json,
       valid = excluded.valid,
       violations = excluded.violations,
       origin = excluded.origin,
       inference_backend = excluded.inference_backend,
       replay = excluded.replay`,
    a.advisory_id,
    typeof a.seq === 'number' ? a.seq : null,
    fieldIdFromAdvisoryId(a.advisory_id) ?? '',
    a.generated_at_utc ?? new Date(0).toISOString(),
    a.schema_version ?? 'unknown',
    JSON.stringify(raw),
    ok ? 1 : 0,
    violations.length ? JSON.stringify(violations) : null,
    origin,
    new Date().toISOString(),
    typeof a.inference_backend === 'string' ? a.inference_backend : null,
    replay ? 1 : 0,
  );

  return { advisoryId: a.advisory_id, valid: ok, violations };
}

/**
 * Ingests an advisory that came from a file rather than from a pod.
 *
 * This is the insurance against the SIH-FIELD access point not landing: the pod
 * can write every advisory to disk as plain JSON, and the demo survives on a
 * file transfer even if no socket ever reaches the pod. It is stored under its
 * own origin because "someone put this file on the phone" is a weaker claim
 * about where a number came from than "the phone pulled it off the pod", and
 * the screen says so.
 */
export async function importAdvisoryFromText(
  text: string,
): Promise<{ advisoryId: string; valid: boolean; violations: Violation[] }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `That is not valid JSON, so it was not imported. (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  // A file containing a manifest or an array of advisories is a plausible
  // mistake to make; say which shape is wanted rather than failing obscurely.
  if (Array.isArray(parsed)) {
    throw new Error('That file holds a list. Import one advisory at a time.');
  }
  return ingestAdvisory(parsed, { origin: 'imported' });
}

const toStored = (row: Row): StoredAdvisory => ({
  advisory: JSON.parse(row.json) as Advisory,
  valid: row.valid === 1,
  violations: row.violations ? (JSON.parse(row.violations) as Violation[]) : [],
  origin: row.origin,
  receivedAtUtc: row.received_at_utc,
});

export async function listAdvisories(limit = 100): Promise<AdvisorySummary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT ${COLUMNS} FROM advisories ${ORDER} LIMIT ?`,
    limit,
  );
  return rows.map((r) => {
    // The full payload is stored verbatim in one column, so the verdict is a
    // parse away rather than a column of its own. At this scale — a handful of
    // advisories per field per day — that is cheaper than another migration.
    let advisory: Advisory | undefined;
    try {
      advisory = JSON.parse(r.json) as Advisory;
    } catch {
      // A row whose JSON will not parse still belongs in the list, flagged.
    }
    return {
      advisoryId: r.advisory_id,
      seq: r.seq,
      fieldId: r.field_id || null,
      generatedAtUtc: r.generated_at_utc,
      valid: r.valid === 1,
      violationCount: r.violations ? (JSON.parse(r.violations) as Violation[]).length : 0,
      origin: r.origin,
      state: advisory?.crop_health?.state ?? null,
      crop: advisory?.crop_health?.crop ?? null,
      topClass: topFinding(advisory),
      inferenceBackend: (r.inference_backend as InferenceBackend | null) ?? null,
      // Stored rows predating the column read as replay, matching `isReplay`.
      replay: r.replay === null ? true : r.replay === 1,
    };
  });
}

export async function getAdvisory(advisoryId: string): Promise<StoredAdvisory | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(
    `SELECT ${COLUMNS} FROM advisories WHERE advisory_id = ?`,
    advisoryId,
  );
  return row ? toStored(row) : null;
}

/**
 * The newest advisories in full, for the home page's latest-scan card and its
 * map. A row whose JSON will not parse is skipped here: it is still in the
 * list, flagged, and has no positions or actions to contribute anyway.
 */
export async function listRecentAdvisories(limit = 20): Promise<StoredAdvisory[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT ${COLUMNS} FROM advisories ${ORDER} LIMIT ?`,
    limit,
  );
  const out: StoredAdvisory[] = [];
  for (const r of rows) {
    try {
      out.push(toStored(r));
    } catch {
      // Unparseable: see above.
    }
  }
  return out;
}

export async function getLatestAdvisory(): Promise<StoredAdvisory | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(`SELECT ${COLUMNS} FROM advisories ${ORDER} LIMIT 1`);
  return row ? toStored(row) : null;
}

export async function countAdvisories(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM advisories');
  return row?.n ?? 0;
}

/** Advisory ids the replica already holds — the input to the delta pull. */
export async function knownAdvisoryIds(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ advisory_id: string }>('SELECT advisory_id FROM advisories');
  return new Set(rows.map((r) => r.advisory_id));
}

/**
 * Removes the shipped sample advisories, leaving everything real untouched.
 *
 * Called when the fixture set has gone stale, or when someone takes the samples
 * out from the pod screen. Invented data is not
 * evidence of anything, so replacing it wholesale is safe in a way that
 * discarding a synced record would not be.
 */
export async function deleteFixtures(): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync("DELETE FROM advisories WHERE origin = 'fixture'");
  return result.changes ?? 0;
}

/**
 * Re-runs the validator over every stored advisory.
 *
 * The validator is the app's half of a contract that is still moving. When it
 * changes, records already in the replica were checked against the old version
 * and their stored verdict is stale — a record that passed last week can be one
 * the current renderer cannot read, which is exactly how the advisory screen
 * came to crash on a `crop_health` block that did not exist yet, and exactly
 * what the move to wire contract v1.0 does to every record written before it.
 *
 * Re-validating on boot keeps the stored verdict honest. Nothing is deleted:
 * a record that now fails is marked failing and rendered as failing, with its
 * violations listed, which is the outcome the whole design is built around.
 */
export async function revalidateAll(): Promise<{ checked: number; nowInvalid: number }> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ advisory_id: string; json: string; valid: number }>(
    'SELECT advisory_id, json, valid FROM advisories',
  );

  let nowInvalid = 0;
  for (const row of rows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.json);
    } catch {
      // Unparseable JSON in the replica is its own kind of broken. Mark it and
      // move on rather than letting one bad row stop the boot.
      await db.runAsync(
        'UPDATE advisories SET valid = 0, violations = ? WHERE advisory_id = ?',
        JSON.stringify([{ rule: 1, path: '$', message: 'stored payload is not valid JSON' }]),
        row.advisory_id,
      );
      nowInvalid++;
      continue;
    }

    const { ok, violations } = validateAdvisory(parsed);
    if (!ok) nowInvalid++;
    if ((row.valid === 1) === ok) continue; // verdict unchanged, skip the write

    await db.runAsync(
      'UPDATE advisories SET valid = ?, violations = ? WHERE advisory_id = ?',
      ok ? 1 : 0,
      violations.length ? JSON.stringify(violations) : null,
      row.advisory_id,
    );
  }

  return { checked: rows.length, nowInvalid };
}
