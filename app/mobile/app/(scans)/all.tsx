/**
 * Every scan held on this phone, newest first, with the three verdict filters.
 *
 * Reached from the home page ("See all", or one of its counts, which opens
 * this list already filtered). Everything shown comes from the local replica;
 * nothing here touches the network, and a farmer who never syncs again still
 * sees every advisory the phone has received.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { listAdvisories } from '../../src/db/advisories.ts';
import type { AdvisorySummary } from '../../src/db/advisories.ts';
import { Muted } from '../../src/ui/components.tsx';
import { CountTiles } from '../../src/ui/count-tiles.tsx';
import type { Filter } from '../../src/ui/count-tiles.tsx';
import { ScanRow, isUnclear, looksHealthy, needsLook } from '../../src/ui/scan-row.tsx';
import { useStatusBarStyle } from '../../src/ui/status-bar.ts';
import { color, radius, space, type } from '../../src/ui/theme.ts';
import { useLanguage } from '../../src/i18n/language.tsx';
import { tr } from '../../src/i18n/tr.ts';

const FILTERS: Record<Exclude<Filter, 'all'>, (r: AdvisorySummary) => boolean> = {
  look: needsLook,
  healthy: looksHealthy,
  unclear: isUnclear,
};

export default function AllScansScreen() {
  const params = useLocalSearchParams<{ filter?: Filter }>();
  const [rows, setRows] = useState<AdvisorySummary[]>([]);
  const [filter, setFilter] = useState<Filter>(
    params.filter && params.filter in FILTERS ? params.filter : 'all',
  );
  useStatusBarStyle('dark');
  useLanguage();

  useFocusEffect(
    useCallback(() => {
      void listAdvisories().then(setRows);
    }, []),
  );

  const shown = filter === 'all' ? rows : rows.filter(FILTERS[filter]);

  return (
    <ScrollView
      style={{ backgroundColor: color.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl }}
    >
      {rows.length > 0 ? <CountTiles rows={rows} active={filter} onChange={setFilter} /> : null}

      {rows.length > 0 ? (
        <View style={s.listHead}>
          <Text style={[type.micro, { color: color.fgSubtle }]}>
            {filter === 'all'
              ? tr('ALL {n} SCANS · NEWEST FIRST', { n: rows.length })
              : tr('{a} OF {n} SCANS', { a: shown.length, n: rows.length })}
          </Text>
          {filter !== 'all' ? (
            <Pressable onPress={() => setFilter('all')} accessibilityRole="button" hitSlop={8}>
              <Text style={[type.label, { color: color.primary }]}>{tr('Show all')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={s.empty}>
          <Muted>{tr('No scans yet. Pull from the pod on the Pod tab.')}</Muted>
        </View>
      )}

      {shown.map((row) => (
        <ScanRow key={row.advisoryId} row={row} />
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  empty: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
  },
});
