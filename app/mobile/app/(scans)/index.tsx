/**
 * Home: what happened on the latest scan, where the problems are, and what
 * else is recent.
 *
 *   1. Latest scan   its verdict, how far to trust it, and the first thing to do
 *   2. Where to look  every flagged finding with a GPS fix, on one map
 *   3. Counts         need a look / healthy / unclear, each opening the list
 *   4. Recent scans   the newest few, then "See all"
 *
 * Everything comes from the local replica. The map's satellite picture needs
 * internet; without it the same positions are drawn on the offline plot.
 *
 * The header band is the site's inverted "deep" section, carrying the same
 * wordmark drawing, so opening the app lands on the same note as the site.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listAdvisories, listRecentAdvisories, topFinding } from '../../src/db/advisories.ts';
import type { AdvisorySummary, StoredAdvisory } from '../../src/db/advisories.ts';
import { DRIED_LEAF_CLASS, describeClass } from '../../src/schema/classes.ts';
import { recallPercent } from '../../src/schema/reliability.ts';
import { presentVerification, renderAction } from '../../src/schema/templates.ts';
import { fieldIdFromAdvisoryId } from '../../src/schema/advisory.ts';
import { describeAge, useSync } from '../../src/sync/state.ts';
import { formatWhen } from '../../src/ui/advisory.tsx';
import { AegisMark, AegisWordmark } from '../../src/ui/brand.tsx';
import { FieldMap, MapLegend } from '../../src/ui/charts.tsx';
import { Eyebrow, Muted, StatusChip, TONE } from '../../src/ui/components.tsx';
import type { Tone } from '../../src/ui/components.tsx';
import { CountTiles } from '../../src/ui/count-tiles.tsx';
import { extentMetres, pickScaleMetres, toMetres, toUnitSquare } from '../../src/ui/field-geometry.ts';
import { FIX_RADIUS_M, SatelliteMap } from '../../src/ui/satellite-map.tsx';
import type { GeoPoint } from '../../src/ui/satellite-map.tsx';
import { ScanRow, rowVerdict } from '../../src/ui/scan-row.tsx';
import { useStatusBarStyle } from '../../src/ui/status-bar.ts';
import { color, radius, shadow, space, type } from '../../src/ui/theme.ts';
import { useLanguage } from '../../src/i18n/language.tsx';
import { currentLanguage, msg, tr } from '../../src/i18n/tr.ts';

const CONNECTION = {
  never_synced: { label: msg('NEVER SYNCED'), note: msg('Nothing has been pulled from a pod on this phone yet.') },
  idle: { label: msg('SYNCED'), note: null },
  syncing: { label: msg('SYNCING'), note: msg('Pulling from the pod.') },
  failed: { label: msg('SYNC FAILED'), note: msg('Last pull did not finish. Open the Pod tab for the reason.') },
};

/** How many recent scans the home page lists before "See all". */
const RECENT = 3;
/** How far back the map looks for flagged findings. */
const MAP_WINDOW = 20;

type Spot = GeoPoint & { advisoryId: string; className: string };

export default function HomeScreen() {
  const [rows, setRows] = useState<AdvisorySummary[]>([]);
  const [recent, setRecent] = useState<StoredAdvisory[]>([]);
  const { state, lastSyncUtc, refresh } = useSync();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Re-renders this screen, and everything on it, when the language changes.
  useLanguage();

  // The band behind the status bar is dark on this screen only.
  useStatusBarStyle('light');

  useFocusEffect(
    useCallback(() => {
      void listAdvisories().then(setRows);
      void listRecentAdvisories(MAP_WINDOW).then(setRecent);
      void refresh();
    }, [refresh]),
  );

  const conn = CONNECTION[state];
  const latest = recent[0];
  const latestRow = rows.find((r) => r.advisoryId === latest?.advisory.advisory_id);
  const spots = problemSpots(recent);
  const flaggedWithoutGps = recent.filter(
    (s) =>
      s.advisory.crop_health?.state === 'DISEASE' &&
      !spots.some((p) => p.advisoryId === s.advisory.advisory_id),
  ).length;

  const open = (id: string) => router.push({ pathname: '/advisory/[id]', params: { id } });

  return (
    <ScrollView
      style={{ backgroundColor: color.background }}
      contentContainerStyle={{ paddingBottom: space.xl }}
      stickyHeaderIndices={[0]}
    >
      <View style={[s.band, { paddingTop: insets.top + space.md }]}>
        <View style={s.bandRow}>
          <View style={s.brand}>
            <AegisMark size={22} color={color.primary} />
            <AegisWordmark height={15} color={color.deepForeground} />
          </View>
          <Pressable onPress={() => router.navigate('/sync')} accessibilityRole="button">
            <Eyebrow onDeep>
              {tr(conn.label)}
              {state === 'idle' ? ` · ${describeAge(lastSyncUtc).toUpperCase()}` : ''}
            </Eyebrow>
          </Pressable>
        </View>
        {conn.note ? (
          <Text style={[type.small, { color: color.deepMuted, marginTop: space.sm }]}>{tr(conn.note)}</Text>
        ) : null}
      </View>

      <View style={{ padding: space.lg }}>
        {rows.length === 0 ? (
          <View style={s.card}>
            <Text style={[type.cardTitle, { color: color.foreground }]}>{tr('No scans yet')}</Text>
            <Muted>
              {tr("Put this phone on the pod's WiFi, then open the Pod tab and pull. Scans show up here with a map of where the problems are.")}
            </Muted>
          </View>
        ) : null}

        {latest && latestRow ? (
          <LatestCard stored={latest} row={latestRow} onOpen={() => open(latestRow.advisoryId)} />
        ) : null}

        {rows.length > 0 ? (
          <View style={s.card}>
            <View style={s.cardHead}>
              <Text style={[type.cardTitle, { color: color.foreground, flex: 1 }]}>{tr('Where to look')}</Text>
              <Text style={[type.valueSmall, { color: color.fgSubtle }]}>
                {spots.length === 1 ? tr('1 spot') : tr('{n} spots', { n: spots.length })}
              </Text>
            </View>
            <Text style={[type.small, { color: color.mutedForeground, marginBottom: space.md }]}>
              {tr('Every flagged finding with a GPS position from your recent scans. Tap a circle to open its scan.')}
            </Text>

            {spots.length > 0 ? (
              <>
                <SatelliteMap points={spots} height={300} onOpen={open} fallback={<OfflinePlot spots={spots} />} />
                <MapLegend items={legendFor(spots)} />
                <Text style={[type.small, { color: color.fgSubtle, marginTop: space.xs }]}>
                  {tr('Circles are about {m} m across the GPS error: a patch of field, not one plant.', { m: FIX_RADIUS_M })}
                </Text>
              </>
            ) : (
              <View style={s.emptyMap}>
                <Text style={[type.label, { color: color.unknown }]}>{tr('Nothing to map yet')}</Text>
                <Text style={[type.small, { color: color.unknown, marginTop: 4 }]}>
                  {tr('No flagged finding in your recent scans had a GPS fix. Leaving the pod in open sky for a minute before scanning usually gets one.')}
                </Text>
              </View>
            )}

            {flaggedWithoutGps > 0 ? (
              <Text style={[type.small, { color: color.unknown, marginTop: space.sm }]}>
                {flaggedWithoutGps === 1
                  ? tr('1 flagged scan has no GPS positions and is not on the map.')
                  : tr('{n} flagged scans have no GPS positions and are not on the map.', { n: flaggedWithoutGps })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {rows.length > 0 ? (
          <>
            <Text style={[type.micro, { color: color.fgSubtle, marginBottom: space.sm }]}>
              {tr('ALL {n} SCANS ON THIS PHONE', { n: rows.length })}
            </Text>
            <CountTiles
              rows={rows}
              onChange={(f) => router.push({ pathname: '/all', params: { filter: f } })}
            />

            <Text style={[type.micro, { color: color.fgSubtle, marginBottom: space.sm }]}>{tr('RECENT')}</Text>
            {rows.slice(0, RECENT).map((row) => (
              <ScanRow key={row.advisoryId} row={row} />
            ))}
            <Pressable
              onPress={() => router.push('/all')}
              accessibilityRole="button"
              style={({ pressed }) => [s.seeAll, pressed && { opacity: 0.7 }]}
            >
              <Text style={[type.label, { color: color.primary }]}>{tr('See all {n} scans ›', { n: rows.length })}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

/**
 * The newest scan, with the one thing to do about it.
 *
 * The reliability line and any mandatory verification caution come before the
 * action, for the same reason they do on the scan screen: a caution read after
 * the instruction is read after deciding.
 */
function LatestCard({
  stored,
  row,
  onOpen,
}: {
  stored: StoredAdvisory;
  row: AdvisorySummary;
  onOpen: () => void;
}) {
  const a = stored.advisory;
  const verdict = rowVerdict(row);
  const t = TONE[verdict.tone];
  const top = topFinding(a);
  const recall = a.crop_health?.state === 'DISEASE' && top ? recallPercent(top) : null;
  const first = a.actions?.[0];
  const action = first ? renderAction(first, currentLanguage()) : null;
  const verification = first ? presentVerification(first.verification_status, currentLanguage()) : null;
  const fieldId = fieldIdFromAdvisoryId(a.advisory_id);
  const crop = top ? describeClass(top).crop : a.crop_health?.crop;

  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityHint={tr('Opens the latest scan')}>
      {({ pressed }) => (
        <View style={[s.latest, { borderColor: t.border }, pressed && { opacity: 0.8 }]}>
          <View style={[s.latestBand, { backgroundColor: t.bg }]}>
            <Text style={[type.micro, { color: t.fg }]}>
              {[tr('LATEST'), fieldId ? tr('FIELD {id}', { id: fieldId }) : null, formatWhen(a.generated_at_utc).toUpperCase()]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text style={[type.title, { color: t.fg, marginTop: 6 }]}>{verdict.text}</Text>
            {crop ? (
              <Text style={[type.label, { color: t.fg, marginTop: 2 }]}>
                {crop.charAt(0).toUpperCase() + crop.slice(1)}
              </Text>
            ) : null}
            {stored.origin !== 'synced' ? (
              <View style={{ marginTop: space.sm }}>
                <StatusChip
                  label={stored.origin === 'fixture' ? tr('SAMPLE') : stored.origin === 'replay' ? tr('REPLAY') : tr('IMPORTED')}
                  tone="neutral"
                />
              </View>
            ) : null}
          </View>

          <View style={{ padding: space.lg }}>
            {recall ? (
              <Text style={[type.small, { color: color.destructive, marginBottom: space.sm }]}>
                {tr('Right {pct} of the time in tests on new cameras. Check by eye before acting.', { pct: recall })}
              </Text>
            ) : null}

            {verification?.mandatory ? (
              <Text style={[type.small, { color: TONE[verification.tone as Tone].fg, marginBottom: space.sm }]}>
                {`${verification.badge}: ${verification.note}`}
              </Text>
            ) : null}

            {action ? (
              <>
                <Text style={[type.micro, { color: color.fgSubtle }]}>{tr('FIRST THING TO DO')}</Text>
                <Text
                  style={[type.body, { color: color.foreground, marginTop: 4, lineHeight: 21 }]}
                  numberOfLines={3}
                >
                  {action.action}
                </Text>
              </>
            ) : (
              <Muted>{tr('No action in this scan.')}</Muted>
            )}

            <Text style={[type.label, { color: color.primary, marginTop: space.md }]}>{tr('Open scan ›')}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** Every located, non-healthy detection in the given scans. */
function problemSpots(recent: StoredAdvisory[]): Spot[] {
  const out: Spot[] = [];
  for (const { advisory: a } of recent) {
    const field = fieldIdFromAdvisoryId(a.advisory_id);
    for (const d of a.detections ?? []) {
      if (typeof d.lat !== 'number' || typeof d.lon !== 'number') continue;
      const info = describeClass(d.class);
      // Positive healthy calls are not problems. Dried leaf is filed under
      // healthy by the model but is worth a look, as everywhere else.
      if (info.category === 'healthy' && d.class !== DRIED_LEAF_CLASS) continue;
      out.push({
        lat: d.lat,
        lon: d.lon,
        tone: d.class === DRIED_LEAF_CLASS ? 'warn' : 'bad',
        label: info.condition,
        sub: [field ? tr('Field {id}', { id: field }) : null, formatWhen(a.generated_at_utc)].filter(Boolean).join(' · '),
        id: a.advisory_id,
        advisoryId: a.advisory_id,
        className: d.class,
      });
    }
  }
  return out;
}

function legendFor(spots: Spot[]): { label: string; tone: Tone }[] {
  const seen = new Map<string, Tone>();
  for (const p of spots) seen.set(p.label, p.tone);
  return [...seen.entries()].map(([label, tone]) => ({ label, tone }));
}

/** The same spots on the no-internet plot. */
function OfflinePlot({ spots }: { spots: Spot[] }) {
  const { metres } = toMetres(spots);
  const span = extentMetres(metres);
  const scaleM = pickScaleMetres(span);
  return (
    <View style={{ alignItems: 'center' }}>
      <FieldMap
        points={metres.map((m, i) => ({ ...toUnitSquare(m, span), weight: 0.8, tone: spots[i].tone }))}
        scaleLabel={`${scaleM} m`}
        scaleFraction={scaleM / span}
      />
    </View>
  );
}

const s = StyleSheet.create({
  band: {
    backgroundColor: color.deep,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.deepBorder,
  },
  bandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    marginBottom: space.lg,
    ...shadow.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  latest: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: space.lg,
    ...shadow.card,
  },
  latestBand: { paddingHorizontal: space.lg, paddingVertical: space.md },
  emptyMap: {
    backgroundColor: color.unknownSurface,
    borderColor: color.unknownBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  seeAll: { alignSelf: 'center', paddingVertical: space.md, paddingHorizontal: space.lg },
});
