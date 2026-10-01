/**
 * The four connection states from §14.2 step 4, all reachable:
 *
 *   never_synced   the replica has only fixtures, or nothing
 *   idle           synced at some point; shows how long ago
 *   syncing        connected and pulling right now
 *   failed         last attempt did not complete, with the reason
 *
 * "The freshness of what the farmer is looking at should never be ambiguous."
 * That is why there is no fifth, vaguer state and no silent fallback between
 * them — every render maps to exactly one of these.
 */

import { useCallback, useEffect, useState } from 'react';

import { getState } from '../db/client.ts';
import { syncNow } from './client.ts';
import type { SyncOutcome, SyncProgress } from './client.ts';
import { tr } from '../i18n/tr.ts';

export type ConnectionState = 'never_synced' | 'idle' | 'syncing' | 'failed';

export type SyncSnapshot = {
  state: ConnectionState;
  lastSyncUtc: string | null;
  error: string | null;
  progress: SyncProgress | null;
  lastOutcome: SyncOutcome | null;
};

const INITIAL: SyncSnapshot = {
  state: 'never_synced',
  lastSyncUtc: null,
  error: null,
  progress: null,
  lastOutcome: null,
};

export function useSync() {
  const [snap, setSnap] = useState<SyncSnapshot>(INITIAL);

  const refresh = useCallback(async () => {
    const [lastSyncUtc, error] = await Promise.all([
      getState('last_sync_utc'),
      getState('last_sync_error'),
    ]);
    setSnap((s) => ({
      ...s,
      lastSyncUtc,
      error,
      state: error ? 'failed' : lastSyncUtc ? 'idle' : 'never_synced',
      progress: null,
    }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(async (): Promise<SyncOutcome> => {
    setSnap((s) => ({ ...s, state: 'syncing', error: null, progress: null }));
    const outcome = await syncNow((progress) => setSnap((s) => ({ ...s, progress })));
    const lastSyncUtc = await getState('last_sync_utc');
    setSnap({
      state: outcome.ok ? 'idle' : 'failed',
      lastSyncUtc,
      error: outcome.error ?? null,
      progress: null,
      lastOutcome: outcome,
    });
    return outcome;
  }, []);

  return { ...snap, run, refresh };
}

/**
 * "Synced 3 h ago" — deliberately coarse. A precise-looking figure on a number
 * this app cannot verify would be its own small fabrication.
 */
export function describeAge(iso: string | null, now: Date = new Date()): string {
  // Display text only, in the app's language; the arithmetic is unchanged.
  if (!iso) return tr('never');
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return tr('unknown');
  const mins = Math.floor((now.getTime() - then) / 60_000);
  if (mins < 1) return tr('just now');
  if (mins < 60) return tr('{n} min ago', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tr('{n} h ago', { n: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? tr('yesterday') : tr('{n} days ago', { n: days });
}
