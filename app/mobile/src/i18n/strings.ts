/**
 * Finds every translatable English string in the app's source.
 *
 * A string is translatable when it is written inside `tr('...')` or
 * `msg('...')`, plus the handful of exported constants and tables that are
 * translated where they are displayed (class names, reliability tiers, the
 * spec's mandatory caveats). `hi.test.ts` uses this to check every one has
 * Hindi; nothing in the app itself imports it.
 *
 * Pure node module: reads files with `fs`, runs under `node --test`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { CLASS_INFO, DRIED_LEAF_CAVEAT } from '../schema/classes.ts';
import { CONFIDENCE_CAVEAT, TIERS } from '../schema/reliability.ts';
import { TRAP_COUNT_DISCLAIMER, VEGETATION_CAVEAT } from '../schema/advisory.ts';

const CALL = /\b(?:tr|msg)\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    // The i18n folder only talks about tr() in comments and holds the Hindi.
    if (statSync(path).isDirectory()) {
      if (name !== 'i18n') out.push(...sourceFiles(path));
    }
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(path);
  }
  return out;
}

function unescape(s: string): string {
  return s.replace(/\\(['"\\])/g, '$1');
}

/** Every English string the app can show through `tr`, with where it is used. */
export function translatableStrings(mobileRoot: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const dir of ['app', 'src']) {
    for (const file of sourceFiles(join(mobileRoot, dir))) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(CALL)) {
        const s = unescape(m[2]);
        if (s.trim() && !found.has(s)) found.set(s, file);
      }
    }
  }

  const tables: [string, string][] = [];
  for (const info of Object.values(CLASS_INFO)) {
    if (info.crop) tables.push([info.crop, 'CLASS_INFO']);
    tables.push([info.condition, 'CLASS_INFO']);
  }
  for (const t of Object.values(TIERS)) {
    tables.push([t.label, 'TIERS'], [t.body, 'TIERS']);
  }
  tables.push(
    [CONFIDENCE_CAVEAT, 'CONFIDENCE_CAVEAT'],
    [DRIED_LEAF_CAVEAT, 'DRIED_LEAF_CAVEAT'],
    [TRAP_COUNT_DISCLAIMER, 'TRAP_COUNT_DISCLAIMER'],
    [VEGETATION_CAVEAT, 'VEGETATION_CAVEAT'],
  );
  for (const [s, where] of tables) if (!found.has(s)) found.set(s, where);

  return found;
}

/** The `{name}` placeholders in a string, sorted, for comparing two strings. */
export function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}
