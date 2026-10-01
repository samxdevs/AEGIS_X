/**
 * The explanation cache (F1).
 *
 * The point of caching is not speed — it is that the explanation has to survive
 * going back offline. The phone generates it once, in the one window where it
 * happens to have internet, and the farmer reads it in the field afterwards
 * with no connection at all. A cache miss in the field is an explanation that
 * does not exist.
 *
 * Keyed on (advisory_id, language) so both languages can be held for the same
 * advisory. Never on the advisory's own tables: this tier is droppable.
 */

import type { Language } from '../llm/prompt.ts';
import { getDb } from './client.ts';

export type StoredExplanation = {
  advisoryId: string;
  language: Language;
  text: string;
  model: string;
  generatedAtUtc: string;
};

type Row = {
  advisory_id: string;
  language: Language;
  text: string;
  model: string;
  generated_at_utc: string;
};

export async function getExplanation(
  advisoryId: string,
  language: Language,
): Promise<StoredExplanation | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(
    'SELECT * FROM explanations WHERE advisory_id = ? AND language = ?',
    advisoryId,
    language,
  );
  if (!row) return null;
  return {
    advisoryId: row.advisory_id,
    language: row.language,
    text: row.text,
    model: row.model,
    generatedAtUtc: row.generated_at_utc,
  };
}

/** Upsert, so regenerating replaces rather than accumulating. */
export async function saveExplanation(e: {
  advisoryId: string;
  language: Language;
  text: string;
  model: string;
}): Promise<StoredExplanation> {
  const generatedAtUtc = new Date().toISOString();
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO explanations (advisory_id, language, text, model, generated_at_utc)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(advisory_id, language) DO UPDATE SET
       text = excluded.text,
       model = excluded.model,
       generated_at_utc = excluded.generated_at_utc`,
    e.advisoryId,
    e.language,
    e.text,
    e.model,
    generatedAtUtc,
  );
  return { ...e, generatedAtUtc };
}

export async function deleteExplanations(advisoryId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM explanations WHERE advisory_id = ?', advisoryId);
}

/** How many advisories have at least one explanation — shown on the sync screen. */
export async function countExplainedAdvisories(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(DISTINCT advisory_id) AS n FROM explanations',
  );
  return row?.n ?? 0;
}
