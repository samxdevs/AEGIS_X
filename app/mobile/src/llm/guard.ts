/**
 * The F2 guard — a generated explanation may not contain a figure that is not
 * in the advisory it explains.
 *
 * Everything else in this project exists to stop a number the pipeline did not
 * measure from reaching a farmer. §14.3 calls the app the last place a
 * fabricated number can be caught. A language model writing the final prose is
 * the first place in the whole system where one can be *created* — after every
 * validator, after the schema, after the renderer that cannot print `null` as
 * zero. It would be a strange place to stop being careful.
 *
 * So the rule is mechanical rather than aspirational: extract every numeric
 * token from the generated text, and require each one to appear somewhere in
 * the source advisory. A model that invents "spray 2.5 ml per litre" fails
 * here, and the text is refused rather than displayed.
 *
 * This is deliberately blunt. It will occasionally refuse an explanation that
 * was fine — a model writing "in the next 2 weeks" when the advisory only says
 * `cwsi_days_remaining: 9`. That trade is the right way round: a refused
 * explanation costs a retry, and a fabricated dose costs a crop. The prompt
 * (see prompt.ts) tells the model to prefer words for small counts, which keeps
 * the false-refusal rate low without weakening the check.
 *
 * Pure module, no React Native imports — it runs under `node --test`.
 */

/** A numeric token as it appeared in the text, with its canonical form. */
export type Figure = { raw: string; canon: string };

export type GuardResult =
  | { ok: true }
  | { ok: false; offending: Figure[] };

/** Matches a run of digits with an optional decimal part and thousands commas. */
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/**
 * Reduces a numeric string to one canonical form, so "0.880", "0.88" and
 * "  .88" all compare equal, and "1,200" equals "1200".
 *
 * Returns null for anything that is not a finite number, which the caller
 * treats as "not a figure" rather than as a violation.
 */
export function canon(raw: string): string | null {
  // `Number('')` and `Number('   ')` are both 0, not NaN, so a string with no
  // digits in it would otherwise canonicalise to the figure zero.
  if (!/\d/.test(raw)) return null;
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? String(n) : null;
}

/**
 * Every figure the advisory can be said to contain.
 *
 * Walks the whole JSON — numbers wherever they appear, and numbers *inside*
 * strings too, because a timestamp (`2026-09-08T14:32:11Z`) and a citation
 * (`NIPHM Sugarcane.pdf p.11`) are both things an explanation may legitimately
 * quote back. Anything the advisory says, the explanation is allowed to repeat.
 */
export function allowedFigures(advisory: unknown): Set<string> {
  const allowed = new Set<string>();

  const addNumber = (n: number): void => {
    if (!Number.isFinite(n)) return;
    const forms = [String(n), n.toFixed(0), n.toFixed(1), n.toFixed(2)];
    // A ratio is very often written as a percentage by anyone explaining it,
    // and 0.88 -> "88%" is a rendering of a measured value, not a new one.
    if (n >= 0 && n <= 1) {
      const pct = n * 100;
      forms.push(String(pct), pct.toFixed(0), pct.toFixed(1));
    }
    for (const f of forms) {
      const c = canon(f);
      if (c !== null) allowed.add(c);
    }
  };

  const walk = (node: unknown): void => {
    if (typeof node === 'number') {
      addNumber(node);
      return;
    }
    if (typeof node === 'string') {
      for (const m of node.match(NUMBER) ?? []) {
        const c = canon(m);
        if (c !== null) allowed.add(c);
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node && typeof node === 'object') {
      for (const value of Object.values(node)) walk(value);
      // Keys can carry figures too — `fao56`, `mlx90640`, `cwsi_days_remaining`.
      for (const key of Object.keys(node)) {
        for (const m of key.match(NUMBER) ?? []) {
          const c = canon(m);
          if (c !== null) allowed.add(c);
        }
      }
    }
  };

  walk(advisory);
  return allowed;
}

/**
 * Strips the numbering a model adds for structure rather than for meaning —
 * "1." or "2)" opening a line, and markdown list bullets.
 *
 * An ordinal in a list is not a claim about the world, and refusing an
 * explanation because it numbered its own paragraphs would make the guard
 * useless without making it safer.
 */
function stripListMarkers(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]\s+|\d{1,2}[.)]\s+)/, ''))
    .join('\n');
}

/**
 * Checks generated text against the advisory it claims to explain.
 *
 * Returns every offending figure rather than the first, so the UI can show what
 * the model made up. Seeing the invented number is the whole point — a silent
 * refusal teaches nobody anything.
 */
export function checkFigures(text: string, advisory: unknown): GuardResult {
  const allowed = allowedFigures(advisory);
  const offending: Figure[] = [];
  const seen = new Set<string>();

  for (const raw of stripListMarkers(text).match(NUMBER) ?? []) {
    const c = canon(raw);
    if (c === null || allowed.has(c) || seen.has(c)) continue;
    seen.add(c);
    offending.push({ raw, canon: c });
  }

  return offending.length === 0 ? { ok: true } : { ok: false, offending };
}
