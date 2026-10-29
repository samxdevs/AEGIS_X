/**
 * The phone's SQLite replica (§6.2, §14.2 step 1).
 *
 * The Jetson's database is the system of record; this is a read-only replica of
 * it plus the phone's own sync cursor. Nothing here ever computes an advisory —
 * if a number is not in the JSON the Jetson sent, this app does not have it.
 *
 * The full advisory JSON is stored verbatim in one column, with a handful of
 * fields lifted out for listing and ordering. Storing the original means a
 * schema change on the Jetson never silently drops data the app did not know to
 * destructure, and it keeps the replica byte-comparable with its source.
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'aegis.db';

let handle: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRATIONS: string[] = [
  // v1 — advisories and sync state.
  `
  CREATE TABLE IF NOT EXISTS advisories (
    advisory_id      TEXT PRIMARY KEY NOT NULL,
    field_id         TEXT NOT NULL,
    generated_at_utc TEXT NOT NULL,
    schema_version   TEXT NOT NULL,
    json             TEXT NOT NULL,
    -- 0 when the advisory broke one of the four §7.3 rules. Kept, not dropped:
    -- a malformed advisory is evidence, and hiding it would be its own failure.
    valid            INTEGER NOT NULL DEFAULT 1,
    violations       TEXT,
    -- §13.0.1 — where this record came from, kept all the way to the screen.
    -- 'synced'   pulled from a pod over the field link, live measurement
    -- 'replay'   real records re-rendered through the pipeline, not a live scan
    -- 'fixture'  invented sample data that never touched a sensor
    -- 'imported' read from a file on this phone rather than pulled from a pod
    -- These are four different claims and the UI must never merge them.
    origin           TEXT NOT NULL DEFAULT 'synced',
    received_at_utc  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_advisories_generated
    ON advisories (generated_at_utc DESC);
  CREATE INDEX IF NOT EXISTS idx_advisories_field
    ON advisories (field_id, generated_at_utc DESC);

  CREATE TABLE IF NOT EXISTS sync_state (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );
  `,
  // v2 — cached LLM explanations (F1). Separate table on purpose: this is the
  // fourth, additive tier, and it must be droppable without touching a single
  // measured value. Nothing in `advisories` references it.
  `
  CREATE TABLE IF NOT EXISTS explanations (
    advisory_id      TEXT NOT NULL,
    language         TEXT NOT NULL,
    text             TEXT NOT NULL,
    model            TEXT NOT NULL,
    generated_at_utc TEXT NOT NULL,
    PRIMARY KEY (advisory_id, language),
    FOREIGN KEY (advisory_id) REFERENCES advisories (advisory_id) ON DELETE CASCADE
  );
  `,
  // v3 — the pod's monotonic sequence number, lifted out for ordering.
  //
  // generated_at_utc cannot order these. The pod has no battery-backed clock
  // and takes UTC from GPS, so until a fix lands its time is whatever the
  // filesystem last recorded — a backwards jump is the expected behaviour on
  // every cold boot, not a fault. seq is the pod's SQLite rowid: assigned at
  // commit, monotonic, never reused, and independent of any clock.
  //
  // Nullable because a record ingested from an older pod or an imported file
  // may not carry one; those sort last and fall back to the timestamp.
  `
  ALTER TABLE advisories ADD COLUMN seq INTEGER;
  CREATE INDEX IF NOT EXISTS idx_advisories_seq ON advisories (seq DESC);
  `,
  // v4 — wire contract v1.0.
  //
  // Two columns lifted out of the payload for the listing, both of which are
  // claims about *where a number came from* and so belong on the row rather
  // than behind a JSON parse:
  //
  //   inference_backend  "trt" on the real device, "onnx" on a CPU fallback,
  //                      "mock" on a synthetic test vector. A production
  //                      gateway refuses to serve the third at all, so a
  //                      stored 'mock' row means something unusual happened.
  //   replay             true when the advisory was assembled from stored
  //                      video rather than captured live. Already resolved
  //                      into `origin`, but kept verbatim so the raw stamp is
  //                      queryable without reparsing every row.
  //
  // `field_id` survives from v1 and is now a display nicety: contract v1.0 has
  // no such field, and the value is parsed off the advisory_id suffix when it
  // has one. It is never used to join, filter or order anything.
  `
  ALTER TABLE advisories ADD COLUMN inference_backend TEXT;
  ALTER TABLE advisories ADD COLUMN replay INTEGER;
  `,
];

/** Opens the replica and brings it up to the current schema version. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  // The promise is stored, not the database, so two callers arriving before the
  // first open finishes share one open and one run of the migrations.
  if (!handle) {
    handle = openAndMigrate().catch((err) => {
      handle = null; // a failed open must be retried, not remembered
      throw err;
    });
  }
  return handle;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
    });
    // PRAGMA does not accept a bound parameter, and v is a loop index we own.
    await db.execAsync(`PRAGMA user_version = ${v + 1}`);
  }

  return db;
}

// ---- sync_state -----------------------------------------------------------

export type SyncKey =
  /**
   * The pod's `seq` of the last advisory that landed here. Drives the delta
   * pull, and is an integer rather than an advisory_id because ids are
   * timestamps and the pod's clock can legitimately run backwards.
   */
  | 'cursor'
  | 'last_sync_utc'
  | 'last_sync_error'
  | 'base_url'
  /**
   * "true" when the gateway is being asked for simulated advisories as well as
   * real ones (`?allow_mock=true`). Stored rather than held in memory so the
   * pod screen can show that the production guard is currently switched off.
   */
  | 'allow_mock'
  /** Last /health body, as JSON, so the connection screen can show clock skew. */
  | 'last_health'
  /** Last /sync/status body, so the mast panel renders before the first poll. */
  | 'last_mast_sync'
  /**
   * Which generation of the shipped fixtures the replica holds. Bumped when the
   * fixture set changes so a stale one cannot survive an app update — see
   * seed.ts, and the crash that made this necessary.
   */
  | 'fixtures_version'
  /** Which schema generation the stored records were last validated against. */
  | 'validated_against'
  /** The language the farmer picked on the Profile screen: 'en' or 'hi'. */
  | 'app_language'
  | 'app_theme'
  /**
   * Which LLM provider the Profile screen is set to, and each provider's key,
   * model and address, as JSON. Stays in the app's private storage on this
   * phone and is never synced anywhere.
   */
  | 'llm_settings'
  /** The field the last walk was started on, offered again in the Start sheet. */
  | 'last_field_id';

export async function getState(key: SyncKey): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM sync_state WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setState(key: SyncKey, value: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO sync_state (key, value) VALUES (?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

/** Test/demo affordance: wipe the replica and start from nothing synced. */
export async function resetReplica(): Promise<void> {
  const db = await getDb();
  await db.execAsync(
    'DELETE FROM explanations; DELETE FROM advisories; DELETE FROM sync_state;',
  );
}
