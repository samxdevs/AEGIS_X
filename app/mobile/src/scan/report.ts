/**
 * What the walk report needs worked out from a walk advisory.
 *
 * Pure functions over the advisory, with no React Native import, so the rules
 * (what counts as "need a look", which alert is the same event as which stretch,
 * what a stop reason says) are tested rather than eyeballed.
 */

import { dateLocale, msg, tr } from '../i18n/tr.ts';
import type { Advisory, Stretch, StretchVerdict, WalkAlert } from '../schema/advisory.ts';

export type ReportTone = 'good' | 'warn' | 'bad' | 'unknown';

/** True for an advisory the farmer's walk produced, false for every older scan. */
export function isWalkReport(a: Advisory | null | undefined): boolean {
  if (!a) return false;
  return a.scan?.mode === 'walk' || Array.isArray(a.stretches) || (!!a.summary && typeof a.summary === 'object');
}

/** "Brown (leaf) rust" -> "brown (leaf) rust", for use inside a sentence. */
export function inSentence(condition: string): string {
  return condition.charAt(0).toLowerCase() + condition.slice(1);
}

// ---- Stretches ------------------------------------------------------------

const VERDICT_TONE: Record<string, ReportTone> = {
  HEALTHY: 'good',
  DISEASE: 'bad',
  UNCERTAIN: 'warn',
  NOT_CROP: 'unknown',
  NO_DATA: 'unknown',
};

const VERDICT_LABEL: Record<string, string> = {
  HEALTHY: msg('Healthy'),
  DISEASE: msg('Need a look'),
  UNCERTAIN: msg('Unclear'),
  NOT_CROP: msg('Not crop'),
  NO_DATA: msg('No data'),
};

/** Green, red, amber, grey. A verdict this build does not know is grey too. */
export function stretchTone(verdict: StretchVerdict | null | undefined): ReportTone {
  return VERDICT_TONE[String(verdict)] ?? 'unknown';
}

export function stretchLabel(verdict: StretchVerdict | null | undefined): string {
  const key = VERDICT_LABEL[String(verdict)];
  return key ? tr(key) : String(verdict ?? '').toLowerCase();
}

/** The stretches in walking order, whatever order the pod listed them in. */
export function orderedStretches(a: Advisory): Stretch[] {
  const list = Array.isArray(a.stretches) ? [...a.stretches] : [];
  return list.sort((x, y) => x.index - y.index);
}

// ---- Stop reason ----------------------------------------------------------

export type StopReasonNote = {
  label: string;
  /** The sentence under the label. Null when the label says it all. */
  detail: string | null;
  /** `unknown` for an ordinary stop, `warn` for one the farmer should notice. */
  tone: ReportTone;
};

/**
 * Why the walk ended, in words.
 *
 * `interrupted` and `time_limit` are the two the farmer did not choose, so they
 * get a warn tone and a sentence; an ordinary stop is one quiet line.
 */
export function stopReasonNote(reason: string | null | undefined): StopReasonNote | null {
  switch (reason) {
    case 'user':
      return { label: tr('Stopped by you'), detail: null, tone: 'unknown' };
    case 'time_limit':
      return {
        label: tr('Stopped at the time limit'),
        detail: tr(
          'The walk reached the longest the pod will scan, so the pod stopped it by itself. Everything up to then is in this report.',
        ),
        tone: 'warn',
      };
    case 'interrupted':
      return {
        label: tr('Interrupted'),
        detail: tr(
          'The pod was switched off or lost power before the walk was stopped. This report was built when it next started, from what it had saved. Nothing up to the cut was lost.',
        ),
        tone: 'warn',
      };
    case 'error':
      return {
        label: tr('Stopped by a problem'),
        detail: tr('The pod stopped this walk because of a problem. What it had recorded up to then is in this report.'),
        tone: 'warn',
      };
    case null:
    case undefined:
      return null;
    default:
      return { label: String(reason).replace(/_/g, ' '), detail: null, tone: 'unknown' };
  }
}

// ---- Need a look ----------------------------------------------------------

export type LookItem = {
  key: string;
  utc: string;
  className: string | null;
  framesAgreeing: number;
  /** True when the phone was buzzed for it during the walk. */
  alerted: boolean;
};

const ms = (iso: string | null | undefined): number => {
  const t = Date.parse(iso ?? '');
  return Number.isNaN(t) ? NaN : t;
};

/**
 * The places to go and look, earliest first.
 *
 * Every alert and every DISEASE stretch. One real event usually produces both:
 * the alert fires while the stretch is being walked, and the stretch is scored
 * once it closes. An alert for the same disease that falls inside a DISEASE
 * stretch is that stretch, so the two are one row, not two.
 */
export function lookItems(a: Advisory): LookItem[] {
  const alerts: WalkAlert[] = Array.isArray(a.alerts) ? a.alerts : [];
  const flagged = orderedStretches(a).filter((s) => s.verdict === 'DISEASE');
  const claimed = new Set<number>();
  const items: LookItem[] = [];

  for (const stretch of flagged) {
    const from = ms(stretch.start_utc);
    const to = ms(stretch.end_utc);
    const matches = alerts.filter((al) => {
      const t = ms(al.utc);
      return (
        !Number.isNaN(t) &&
        !Number.isNaN(from) &&
        !Number.isNaN(to) &&
        t >= from &&
        t <= to &&
        (stretch.top_class === null || al.class === stretch.top_class)
      );
    });
    matches.forEach((m) => claimed.add(m.alert_id));
    items.push({
      key: `s${stretch.index}`,
      utc: stretch.start_utc,
      className: stretch.top_class ?? matches[0]?.class ?? null,
      framesAgreeing: Math.max(stretch.frames_agreeing ?? 0, ...matches.map((m) => m.frames_agreeing ?? 0)),
      alerted: matches.length > 0,
    });
  }

  for (const al of alerts) {
    if (claimed.has(al.alert_id)) continue;
    items.push({
      key: `a${al.alert_id}`,
      utc: al.utc,
      className: al.class,
      framesAgreeing: al.frames_agreeing ?? 0,
      alerted: true,
    });
  }

  return items.sort((x, y) => (ms(x.utc) || 0) - (ms(y.utc) || 0));
}

// ---- Map ------------------------------------------------------------------

export type ReportMark = {
  key: string;
  lat: number;
  lon: number;
  /** The circle's radius in metres. 0 when the position has no stated accuracy. */
  radiusM: number;
  tone: ReportTone;
  kind: 'stretch' | 'alert';
  className: string | null;
  utc: string;
  verdict?: StretchVerdict;
};

const located = (lat: unknown, lon: unknown): boolean =>
  typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon);

const radiusOf = (acc: unknown): number =>
  typeof acc === 'number' && Number.isFinite(acc) && acc > 0 ? acc : 0;

/**
 * Everything on the walk that has a position: each stretch, then each alert.
 * A circle is the position's own stated accuracy, never a made-up one.
 */
export function reportMarks(a: Advisory): ReportMark[] {
  const marks: ReportMark[] = [];
  for (const s of orderedStretches(a)) {
    if (!located(s.lat, s.lon)) continue;
    marks.push({
      key: `s${s.index}`,
      lat: s.lat as number,
      lon: s.lon as number,
      radiusM: radiusOf(s.pos_accuracy_m),
      tone: stretchTone(s.verdict),
      kind: 'stretch',
      className: s.top_class ?? null,
      utc: s.start_utc,
      verdict: s.verdict,
    });
  }
  for (const al of Array.isArray(a.alerts) ? a.alerts : []) {
    if (!located(al.lat, al.lon)) continue;
    marks.push({
      key: `a${al.alert_id}`,
      lat: al.lat as number,
      lon: al.lon as number,
      radiusM: radiusOf(al.pos_accuracy_m),
      tone: 'bad',
      kind: 'alert',
      className: al.class,
      utc: al.utc,
    });
  }
  return marks;
}

// ---- Time -----------------------------------------------------------------

/** "4:34:40 pm": the time of day, to the second, in the app's language. */
export function formatClock(iso: string | null | undefined): string {
  const d = new Date(iso ?? '');
  if (Number.isNaN(d.getTime())) return iso ?? tr('unknown');
  return d.toLocaleTimeString(dateLocale(), { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

// ---- Provenance line ------------------------------------------------------

const CLOCK_LABEL: Record<string, string> = {
  gps: msg('GPS'),
  phone: msg('phone'),
  filesystem: msg('pod storage'),
};

const POSITION_LABEL: Record<string, string> = {
  pod_gps: msg('pod GPS'),
  phone_gps: msg('phone GPS'),
};

/**
 * One neutral line for "About this scan": where the time and the positions came
 * from. Using the phone for either is ordinary, so this states it and nothing
 * more. Null when the advisory says neither.
 */
export function sourceLine(a: Advisory): string | null {
  const clock = a.time_source ? (CLOCK_LABEL[String(a.time_source)] ?? String(a.time_source)) : null;

  // The scan-level source when there is one; otherwise whatever the stretches
  // report, if they all agree.
  const fromStretches = new Set(
    orderedStretches(a)
      .map((s) => s.pos_source)
      .filter((x): x is NonNullable<typeof x> => !!x),
  );
  const rawPos = a.gps?.source ?? (fromStretches.size === 1 ? [...fromStretches][0] : null);
  const pos = rawPos ? (POSITION_LABEL[String(rawPos)] ?? String(rawPos)) : null;

  if (!clock && !pos) return null;
  return [
    clock ? tr('Time from {source}.', { source: tr(clock) }) : null,
    pos ? tr('Positions from {source}.', { source: tr(pos) }) : null,
  ]
    .filter(Boolean)
    .join(' ');
}
