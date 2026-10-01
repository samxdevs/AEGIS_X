/**
 * The Fields tab: the same scans as the Scans tab, grouped by field.
 *
 * A farmer thinks in plots, not in a timeline. This answers "how is F02
 * doing?" without scrolling past every other field's history — the latest
 * verdict leads each card, with the field's recent scans underneath.
 *
 * Built only from the local replica, like the list. The field id is parsed off
 * the advisory id suffix, so a record without one is grouped as "No field".
 */

import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { listAdvisories } from '../src/db/advisories.ts';
import type { AdvisorySummary } from '../src/db/advisories.ts';
import { formatWhen } from '../src/ui/advisory.tsx';
import { Muted, StatusChip } from '../src/ui/components.tsx';
import { ScanRow, looksHealthy, needsLook, rowVerdict } from '../src/ui/scan-row.tsx';
import { useStatusBarStyle } from '../src/ui/status-bar.ts';
import { useLanguage } from '../src/i18n/language.tsx';
import { tr } from '../src/i18n/tr.ts';
import { color, radius, shadow, space, type } from '../src/ui/theme.ts';

/** How many of a field's scans show under its headline. */
const RECENT = 3;

export default function FieldsScreen() {
  const [rows, setRows] = useState<AdvisorySummary[]>([]);
  useStatusBarStyle('dark');
  useLanguage();

  useFocusEffect(
    useCallback(() => {
      void listAdvisories().then(setRows);
    }, []),
  );

  // listAdvisories is newest first, so the first row seen per field is its
  // latest scan and the grouped lists stay in that order.
  const fields = new Map<string, AdvisorySummary[]>();
  for (const r of rows) {
    const key = r.fieldId ?? '';
    fields.set(key, [...(fields.get(key) ?? []), r]);
  }
  const ordered = [...fields.entries()].sort(([a], [b]) =>
    a === '' ? 1 : b === '' ? -1 : a.localeCompare(b),
  );

  return (
    <ScrollView
      style={{ backgroundColor: color.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl }}
    >
      {ordered.length === 0 ? (
        <View style={s.card}>
          <Muted>{tr('No scans yet, so no fields to show.')}</Muted>
        </View>
      ) : null}

      {ordered.map(([fieldId, scans]) => {
        const latest = scans[0];
        const look = scans.filter(needsLook).length;
        // Zero flagged is not the same as healthy: a field whose latest scan
        // was too unclear to call says so rather than "nothing flagged".
        const badge =
          look > 0
            ? {
                label: look === 1 ? tr('1 NEEDS A LOOK') : tr('{n} NEED A LOOK', { n: look }),
                tone: 'bad' as const,
              }
            : looksHealthy(latest)
              ? { label: tr('LOOKS HEALTHY'), tone: 'good' as const }
              : { label: rowVerdict(latest).text.toUpperCase(), tone: 'warn' as const };
        return (
          <View key={fieldId || 'none'} style={s.field}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: color.foreground }]}>
                  {fieldId ? tr('Field {id}', { id: fieldId }) : tr('No field')}
                </Text>
                <Text style={[type.small, { color: color.mutedForeground, marginTop: 2 }]}>
                  {`${tr('Last scanned {when}', { when: formatWhen(latest.generatedAtUtc) })} · ${
                    scans.length === 1 ? tr('1 scan') : tr('{n} scans', { n: scans.length })
                  }`}
                </Text>
              </View>
              <StatusChip label={badge.label} tone={badge.tone} />
            </View>

            <View style={{ height: space.md }} />

            {scans.slice(0, RECENT).map((row) => (
              <ScanRow key={row.advisoryId} row={row} showField={false} />
            ))}
            {scans.length > RECENT ? (
              <Text style={[type.small, { color: color.fgSubtle }]}>
                {tr('{n} older scans on the All scans list.', { n: scans.length - RECENT })}
              </Text>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    ...shadow.card,
  },
  field: { marginBottom: space.xl },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
});
