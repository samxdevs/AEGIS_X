/**
 * One scan in a list — shared by the Scans and Fields tabs so the two can
 * never disagree about what a scan's verdict is.
 *
 * Leads with the verdict rather than the field id, because "looks healthy" and
 * "something was found" are what someone is scanning the list for. The colour
 * stripe on the left repeats the verdict for a glance; the words carry it.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import type { AdvisorySummary } from '../db/advisories.ts';
import { DRIED_LEAF_CLASS, describeClass } from '../schema/classes.ts';
import { recallPercent } from '../schema/reliability.ts';
import { StatusChip, TONE } from './components.tsx';
import type { Tone } from './components.tsx';
import { formatWhen } from './advisory.tsx';
import { color, radius, shadow, space, type } from './theme.ts';
import { tr } from '../i18n/tr.ts';

/** The one-line verdict for a row. Never "healthy" for a dried-leaf call. */
export function rowVerdict(row: AdvisorySummary): { text: string; tone: Tone } {
  if (row.topClass === DRIED_LEAF_CLASS) {
    return { text: tr('Dried leaf, worth a look'), tone: 'warn' };
  }
  const byState: Record<string, { text: string; tone: Tone }> = {
    HEALTHY: { text: tr('Looks healthy'), tone: 'good' },
    DISEASE: {
      text: row.topClass ? describeClass(row.topClass).condition : tr('Something was found'),
      tone: 'bad',
    },
    NOT_CROP: { text: tr('Not crop'), tone: 'unknown' },
    UNCERTAIN: { text: tr('Not clear enough to say'), tone: 'warn' },
    NO_DATA: { text: tr('Nothing scanned'), tone: 'unknown' },
  };
  if (!row.state) {
    return {
      text: row.fieldId ? tr('Field {id}', { id: row.fieldId }) : tr('Scan {n}', { n: row.seq ?? '' }),
      tone: 'unknown',
    };
  }
  return byState[row.state] ?? { text: String(row.state), tone: 'unknown' };
}

/**
 * Dried leaf counts as needing a look even though the model files it under
 * healthy — see rowVerdict. The two must not disagree.
 */
export function needsLook(r: AdvisorySummary): boolean {
  return r.state === 'DISEASE' || r.topClass === DRIED_LEAF_CLASS;
}
export function looksHealthy(r: AdvisorySummary): boolean {
  return r.state === 'HEALTHY' && r.topClass !== DRIED_LEAF_CLASS;
}
export function isUnclear(r: AdvisorySummary): boolean {
  return r.state === 'UNCERTAIN' || r.state === 'NO_DATA';
}

/**
 * The reliability warning for a row, without opening the advisory.
 *
 * A finding on a class that fails on unseen cameras should not be able to sit
 * in the list looking like a confirmed diagnosis, because the list is where
 * most looking happens. The tier lives on `detections[]` rather than on the
 * summary, so this reads the class table instead — the tier is a property of
 * the class, which is exactly what makes that lookup sound.
 */
function rowReliability(row: AdvisorySummary): string | null {
  if (row.state !== 'DISEASE' || !row.topClass) return null;
  const recall = recallPercent(row.topClass);
  if (recall === null) return null;
  return tr('RIGHT {pct} IN TESTS', { pct: recall });
}

export function ScanRow({ row, showField = true }: { row: AdvisorySummary; showField?: boolean }) {
  const verdict = rowVerdict(row);
  const reliability = rowReliability(row);
  const t = TONE[verdict.tone];

  // Only the exceptions get a chip. The verdict itself is the headline, so a
  // DISEASE / HEALTHY chip under it was saying the same thing twice.
  const chips: { label: string; tone: Tone }[] = [];
  if (reliability) chips.push({ label: reliability, tone: 'bad' });
  if (row.origin === 'fixture') chips.push({ label: tr('SAMPLE'), tone: 'neutral' });
  if (row.origin === 'replay') chips.push({ label: tr('REPLAY'), tone: 'unknown' });
  if (row.origin === 'imported') chips.push({ label: tr('IMPORTED'), tone: 'unknown' });
  // A production gateway never serves one of these, so a mock advisory on
  // this phone is worth flagging in the list rather than only on the record.
  if (row.inferenceBackend === 'mock') chips.push({ label: tr('SIMULATED MODEL'), tone: 'bad' });
  if (row.inferenceBackend === 'onnx') chips.push({ label: tr('FALLBACK ENGINE'), tone: 'warn' });
  if (!row.valid) {
    chips.push({
      label:
        row.violationCount === 1
          ? tr('1 SCHEMA VIOLATION')
          : tr('{n} SCHEMA VIOLATIONS', { n: row.violationCount }),
      tone: 'bad',
    });
  }

  return (
    // href takes the object form rather than a template literal: it stays
    // valid once expo-router generates its typed-route definitions, and it
    // escapes the id (advisory ids contain ':') without doing it by hand.
    <Link href={{ pathname: '/advisory/[id]', params: { id: row.advisoryId } }} asChild>
      <Pressable accessibilityRole="button">
        {({ pressed }) => (
          <View
            style={[
              s.row,
              !row.valid && { borderColor: color.destructiveBorder },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={[s.stripe, { backgroundColor: verdict.tone === 'neutral' ? color.border : t.fg }]} />
            <View style={s.body}>
              <View style={s.head}>
                <Text style={[type.cardTitle, { color: color.foreground, flex: 1 }]} numberOfLines={1}>
                  {verdict.text}
                </Text>
                <Text style={[type.chipValue, { color: color.fgSubtle, fontSize: 16 }]}>›</Text>
              </View>
              <Text style={[type.small, { color: color.mutedForeground, marginTop: 2 }]}>
                {formatWhen(row.generatedAtUtc)}
                {showField && row.fieldId ? ` · ${tr('Field {id}', { id: row.fieldId })}` : ''}
              </Text>
              {chips.length > 0 ? (
                <View style={s.chips}>
                  {chips.map((c) => (
                    <StatusChip key={c.label} label={c.label} tone={c.tone} />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    marginBottom: space.sm,
    overflow: 'hidden',
    ...shadow.card,
  },
  stripe: { width: 5 },
  body: { flex: 1, paddingVertical: space.md, paddingHorizontal: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm },
});
