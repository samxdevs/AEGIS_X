/**
 * The app's language, and the one function that translates on-screen text.
 *
 * Every farmer-facing English string is written in the code as it reads in
 * English, wrapped in `tr(...)`. In Hindi, `tr` looks it up in `hi.ts`; in
 * English it returns it unchanged. Keeping the English inline keeps the code
 * readable, and `hi.test.ts` fails if any wrapped string has no Hindi, so a
 * new string cannot ship untranslated by accident.
 *
 * Placeholders are `{name}`, filled from `params` after the lookup, so the
 * Hindi can put them wherever its word order needs them.
 *
 * The language lives here as module state rather than only in React context,
 * because pure helpers (`describeClass`, `humaniseStatus`) produce text too.
 * `LanguageProvider` sets it; screens re-render through `useLanguage()`.
 *
 * Pure module, no React Native imports: it runs under `node --test`.
 */

import { HI } from './hi.ts';

export type AppLanguage = 'en' | 'hi';

let current: AppLanguage = 'en';

export function setCurrentLanguage(language: AppLanguage): void {
  current = language;
}

export function currentLanguage(): AppLanguage {
  return current;
}

export function tr(english: string, params?: Record<string, string | number>): string {
  const text = current === 'hi' ? (HI[english] ?? english) : english;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole: string, key: string) =>
    key in params ? String(params[key]) : whole,
  );
}

/**
 * Marks a string for translation where it is defined, in a lookup table,
 * without translating it there. Tables are built once at load, before the
 * farmer has picked a language, so the entry is translated where it is shown:
 * `tr(TABLE[key])`. Returns its argument; it exists so `hi.test.ts` can find
 * every such string and check it has Hindi.
 */
export function msg(english: string): string {
  return english;
}

/** The locale for dates and times: Devanagari month names in Hindi. */
export function dateLocale(): string | undefined {
  return current === 'hi' ? 'hi-IN' : undefined;
}
