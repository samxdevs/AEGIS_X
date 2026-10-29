/**
 * The three verdict counts, as tappable tiles.
 *
 * Shared by the home page (where a tap opens the list filtered) and the full
 * list (where a tap filters in place). Counted from the same predicates as the
 * rows, so a tile can never disagree with the list it opens.
 */

import { StyleSheet, Text, View } from 'react-native';

import type { AdvisorySummary } from '../db/advisories.ts';
import { TONE } from './components.tsx';
import { PressScale } from './motion.tsx';
import type { Tone } from './components.tsx';
import { isUnclear, looksHealthy, needsLook } from './scan-row.tsx';
import { color, radius, shadow, space, type, themed } from './theme.ts';
import { tr } from '../i18n/tr.ts';

export type Filter = 'all' | 'look' | 'healthy' | 'unclear';

export function CountTiles({
  rows,
  active = 'all',
  onChange,
}: {
  rows: AdvisorySummary[];
  active?: Filter;
  /** Receives the tapped filter, or 'all' when the active one is tapped again. */
  onChange: (f: Filter) => void;
}) {
  const look = rows.filter(needsLook).length;
  const tiles: { key: Exclude<Filter, 'all'>; value: number; label: string; tone: Tone }[] = [
    {
      key: 'look',
      value: look,
      label: look === 1 ? tr('needs a look') : tr('need a look'),
      tone: look > 0 ? 'bad' : 'good',
    },
    { key: 'healthy', value: rows.filter(looksHealthy).length, label: tr('healthy'), tone: 'good' },
    { key: 'unclear', value: rows.filter(isUnclear).length, label: tr('unclear'), tone: 'warn' },
  ];

  return (
    <View style={s.tiles}>
      {tiles.map((t) => {
        const on = active === t.key;
        const c = TONE[t.tone];
        return (
          <PressScale
            key={t.key}
            onPress={() => onChange(on ? 'all' : t.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityHint={tr('Shows scans that are {what}', { what: t.label })}
            outerStyle={{ flex: 1 }}
            style={[s.tile, on && { borderColor: c.fg, backgroundColor: c.bg }]}
          >
            <Text style={[type.stat, { color: t.value === 0 ? color.fgSubtle : c.fg }]}>{t.value}</Text>
            <Text style={[type.small, { color: color.mutedForeground }]}>{t.label}</Text>
          </PressScale>
        );
      })}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  tiles: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  tile: {
    flex: 1,
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    ...shadow.card,
  },
}));
