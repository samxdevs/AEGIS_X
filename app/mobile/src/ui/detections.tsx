/**
 * The classifier's findings, and where in the field they happened.
 *
 * ── The thing this file exists to prevent ───────────────────────────────────
 * The device capture the hardware team sent carries
 * `rice__bacterial_leaf_blight` at **0.9817** confidence with
 * `cross_source_reliability: TESTED_FAILED`. On held-out camera rigs that class
 * recovers **0.00%** of its cases. Those two numbers are both true and they are
 * about different things: confidence is the model's certainty in its own
 * answer, and reliability is whether that certainty has ever been worth
 * anything on a camera it did not train against.
 *
 * A screen that renders "98% — bacterial leaf blight" has told a farmer
 * something almost certainly wrong, in the most persuasive form available, and
 * may well get a field sprayed with streptocycline for nothing.
 *
 * So on this card the tier leads and the confidence follows, with the held-out
 * recall printed beside it wherever the registry gives one. That is not
 * hedging — it is the actual state of the evidence, and it is the difference
 * between a demo and a system.
 *
 * ── Why the map is a plot and not a basemap ─────────────────────────────────
 * The pod tags each detection with a handheld GPS fix at roughly 2.5 m CEP, no
 * RTK. That locates a corner of a field, not a plant. Drawing those points over
 * a street map or a satellite tile would imply a precision the receiver does
 * not have, and zooming in far enough to see individual plants would imply it
 * even harder. There is also no tile provider to call: a map that had to
 * download anything would be the one screen that stopped working in a field, in
 * a system whose entire claim is that it needs no cloud at any point.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Muted, Panel, SourceTag, StatusChip } from './components.tsx';
import type { Tone } from './components.tsx';
import { FieldMap, MapLegend, Stat } from './charts.tsx';
import type { MapPoint } from './charts.tsx';
import { FIX_RADIUS_M, SatelliteMap } from './satellite-map.tsx';
import type { GeoPoint } from './satellite-map.tsx';
import {
  describeSpread,
  extentMetres,
  pickScaleMetres,
  toMetres,
  toUnitSquare,
} from './field-geometry.ts';
import { color, space, type } from './theme.ts';
import { dateLocale, msg, tr } from '../i18n/tr.ts';
import type { Advisory, CrossSourceReliability, Detection } from '../schema/advisory.ts';
import { describeClass } from '../schema/classes.ts';
import {
  CONFIDENCE_CAVEAT,
  describeReliability,
  recallPercent,
} from '../schema/reliability.ts';

type Located = Detection & { lat: number; lon: number };

const isLocated = (d: Detection): d is Located =>
  typeof d.lat === 'number' && typeof d.lon === 'number';

const TIER_TONE: Record<string, Tone> = {
  TESTED_ROBUST: 'good',
  TESTED_WEAK: 'warn',
  TESTED_FAILED: 'bad',
  UNTESTED: 'unknown',
};

/**
 * The trust label a farmer reads on each finding.
 *
 * Shorter than the registry's tier labels so it fits on the row beside the
 * name, and phrased as how often the call is right — which is the question
 * being asked. The full tier sentence is one tap down, in the row's detail.
 */
const TRUST_LABEL: Record<string, string> = {
  TESTED_ROBUST: msg('USUALLY RIGHT'),
  TESTED_WEAK: msg('OFTEN WRONG'),
  TESTED_FAILED: msg('RARELY RIGHT'),
  UNTESTED: msg('UNTESTED'),
};

/** How many findings show before "Show more". */
const FOLD_AFTER = 3;

type Finding = {
  className: string;
  confidence: number;
  frames: number;
  tier: CrossSourceReliability | undefined;
  source: Advisory['disease'][number]['source'];
};

/**
 * Findings across the whole scan, one row each.
 *
 * `disease[]` in contract v1.0 is thin — class, confidence, empty media list —
 * so the per-class evidence comes from joining it against `detections[]`,
 * which is where the reliability tier and the repeat count live.
 *
 * ── What a row shows, and why the confidence is not on it ───────────────────
 * The row leads with the trust label, then the frame count. The model's
 * confidence is only in the row's detail, underneath the tier explanation.
 * High confidence is exactly the state in which a reader stops reading
 * caveats, and on this model it is close to unrelated to being right — so a
 * folded row no longer shows it at all, rather than showing it beside a
 * warning. TESTED_FAILED rows carry their warning on the row itself, unfolded.
 */
export function DiseaseCard({ advisory }: { advisory: Advisory }) {
  const [showAll, setShowAll] = useState(false);
  const disease = advisory.disease ?? [];
  const detections = advisory.detections ?? [];

  if (disease.length === 0) {
    return (
      <Card title={tr('What the camera found')}>
        <Muted>
          {tr('Nothing was flagged in this scan. See the verdict above for what that means. An empty list here is not the same as a clean bill of health.')}
        </Muted>
      </Card>
    );
  }

  // One row per class, as the contract defines `disease[]`. The pod has sent
  // the same class twice (wheat__brown_rust at 0.89 and 0.86, 25 Sep replay);
  // both rows joined to the same detections, so they were one finding drawn
  // twice. Keep the stronger.
  const byClass = new Map<string, (typeof disease)[number]>();
  for (const d of disease) {
    const seen = byClass.get(d.class);
    if (!seen || d.confidence > seen.confidence) byClass.set(d.class, d);
  }

  const findings: Finding[] = [...byClass.values()]
    // Strongest first. The pod orders these, but not by contract.
    .sort((a, b) => b.confidence - a.confidence)
    .map((d) => {
      const hits = detections.filter((x) => x.class === d.class);
      return {
        className: d.class,
        confidence: d.confidence,
        frames: hits.length,
        // The tier is a property of the class, so any detection of it carries
        // the same one. Taking the first is not a sample, it is a lookup.
        tier: hits[0]?.cross_source_reliability,
        source: d.source,
      };
    });

  const shown = showAll ? findings : findings.slice(0, FOLD_AFTER);
  const hidden = findings.length - shown.length;
  const photosPruned = disease.every((d) => Array.isArray(d.media_ids) && d.media_ids.length === 0);

  return (
    <Card
      title={tr('What the camera found')}
      right={<Text style={[type.chipValue, { color: color.fgSubtle }]}>{findings.length}</Text>}
    >
      {/* One standing line for the whole card, above every row. */}
      <Text style={[type.small, { color: color.warningForeground, marginBottom: space.xs }]}>
        {tr('Check every finding by eye before treating. Tap one for the details.')}
      </Text>

      {shown.map((f, i) => (
        <FindingRow key={f.className} finding={f} strongest={i === 0 && findings.length > 1} />
      ))}

      {hidden > 0 || showAll ? (
        <Pressable
          onPress={() => setShowAll((v) => !v)}
          accessibilityRole="button"
          style={({ pressed }) => [s.more, pressed && { opacity: 0.6 }]}
        >
          <Text style={[type.label, { color: color.primary }]}>
            {showAll ? tr('Show fewer') : tr('Show {n} more', { n: hidden })}
          </Text>
        </Pressable>
      ) : null}

      {/* The standing confidence caveat, from its constant, once per card.
          Every confidence figure on this card sits inside a row's detail,
          below this. */}
      <Text style={[type.small, { color: color.fgSubtle, marginTop: space.sm }]}>
        {tr(CONFIDENCE_CAVEAT)}
        {/* Contract: media_ids is always present and always empty, because the
            pod prunes images to save storage. Said once, not per row. */}
        {photosPruned ? ` ${tr('Photos are not kept on the pod.')}` : ''}
      </Text>
    </Card>
  );
}

function FindingRow({ finding: f, strongest }: { finding: Finding; strongest: boolean }) {
  const [open, setOpen] = useState(false);
  const described = describeClass(f.className);
  const info = describeReliability(f.tier);
  const tone = f.tier ? (TIER_TONE[String(f.tier)] ?? 'bad') : 'bad';
  const trustKey = f.tier ? TRUST_LABEL[String(f.tier)] : undefined;
  const trust = trustKey ? tr(trustKey) : f.tier ? info.label : tr('NO TRUST DATA');
  const recall = recallPercent(f.className);

  return (
    <View style={s.findingRow}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [s.findingHead, pressed && { opacity: 0.6 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[type.label, { color: color.foreground, fontFamily: type.cardTitle.fontFamily }]}>
            {described.condition}
          </Text>
          <Text style={[type.small, { color: color.mutedForeground, marginTop: 2 }]}>
            {[
              described.crop ?? f.className,
              f.frames === 1 ? tr('1 frame') : tr('{n} frames', { n: f.frames }),
              strongest ? tr('strongest') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <StatusChip label={trust} tone={tone} />
        <Text style={[type.chipValue, { color: color.fgSubtle, fontSize: 16 }]}>
          {open ? '−' : '+'}
        </Text>
      </Pressable>

      {/* A class that fails on unseen cameras carries its warning on the row,
          folded or not. */}
      {f.tier === 'TESTED_FAILED' && !open ? (
        <Text style={[type.small, { color: color.destructive, marginTop: -2, marginBottom: space.sm }]}>
          {recall
            ? tr('Right {pct} of the time in tests on new cameras. A prompt to look, not a diagnosis.', { pct: recall })
            : tr('Almost never right in tests on new cameras. A prompt to look, not a diagnosis.')}
        </Text>
      ) : null}

      {open ? (
        <View style={{ paddingBottom: space.md }}>
          {/* Tier first, deliberately. It decides what the confidence under it
              is worth. */}
          <Panel label={tr('How much to trust this')} tone={tone}>
            {info.body}
            {recall
              ? ` ${tr('On the independent test set this class was recognised correctly {pct} of the time.', { pct: recall })}`
              : ''}
          </Panel>

          <View style={s.statRow}>
            <Stat
              value={String(f.frames)}
              caption={f.frames === 1 ? tr('Frame it appeared in') : tr('Frames it appeared in')}
              tone={f.frames > 2 ? 'bad' : 'neutral'}
            />
            <Stat value={f.confidence.toFixed(2)} caption={tr('Model certainty')} />
            {/* "?" rather than "untested" in a third-width column, where the
                word was cut to "untes…"; the caption carries the meaning. */}
            <Stat
              value={recall ?? '?'}
              caption={recall ? tr('Right on new cameras') : tr('Never tested on new cameras')}
              tone={recall ? 'warn' : 'unknown'}
            />
          </View>

          {/* Seen once and never again is the weakest shape this evidence
              takes, and it is worth naming rather than leaving the reader to
              infer it from a count of one. */}
          {f.frames === 1 ? (
            <Text style={[type.small, { color: color.mutedForeground, marginTop: space.sm }]}>
              {tr('Seen in a single frame. A real lesion usually shows up in several as you walk past it, so this one is worth a second look.')}
            </Text>
          ) : null}

          <View style={{ marginTop: space.sm, alignSelf: 'flex-start' }}>
            <SourceTag source={f.source} />
          </View>
        </View>
      ) : null}
    </View>
  );
}


/**
 * The clustering verdict in words a farmer can act on.
 *
 * "Clustered" on its own is a statistic. "Start where they are densest" is the
 * thing to go and do, which is what a map of a field is for.
 */
const SPREAD_COPY: Record<string, (m: number) => string> = {
  Clustered: (m) =>
    tr('The findings sit close together, about {m} m apart on average. Start where they are densest.', { m }),
  'Loosely grouped': (m) => tr('The findings are somewhat grouped, about {m} m apart on average.', { m }),
  'Spread out': (m) =>
    tr('The findings are scattered across the area you scanned, roughly {m} m apart on average, rather than concentrated in one place.', { m }),
};

const SPREAD_LABEL: Record<string, string> = {
  Clustered: msg('Clustered'),
  'Loosely grouped': msg('Loosely grouped'),
  'Spread out': msg('Spread out'),
};

export function DetectionsCard({ advisory }: { advisory: Advisory }) {
  const detections = advisory.detections ?? [];
  const gps = advisory.gps;
  const located = detections.filter(isLocated);
  const unlocated = detections.length - located.length;

  if (detections.length === 0) {
    return (
      <Card eyebrow={tr('Where')} title={tr('Where in the field')} summary={tr('Nothing to place on a map')}>
        <Muted>
          {gps?.status === 'ABSENT'
            ? tr('No satellite fix during this scan, and nothing was flagged to place on a map.')
            : tr('Nothing was flagged in this scan, so there is nothing to place on a map.')}
        </Muted>
      </Card>
    );
  }

  if (located.length === 0) {
    return (
      <Card
        eyebrow={tr('Where')}
        title={tr('Where in the field')}
        summary={
          detections.length === 1
            ? tr('No GPS position for 1 finding')
            : tr('No GPS positions for {n} findings', { n: detections.length })
        }
        summaryTone="unknown"
      >
        <Panel label={tr('No positions')} tone="unknown">
          {gps?.status === 'ABSENT'
            ? tr('{n} findings were made but none could be positioned because the pod never got a satellite fix. The findings are still real; only their locations are missing.', { n: detections.length })
            : tr('{n} findings were made but none could be positioned. The findings are still real; only their locations are missing.', { n: detections.length })}
        </Panel>
        <Muted>
          {tr('Leaving the pod in open sky for a minute before a scan usually gets a fix. Without one, you get the findings but not a map of where they are.')}
        </Muted>
      </Card>
    );
  }

  // ---- Project to metres, then to the unit square -------------------------
  // The geometry lives in field-geometry.ts and is unit-tested there: a mark in
  // the wrong place still looks like a map, so this is not a thing to eyeball.

  const { metres } = toMetres(located);
  const span = extentMetres(metres);

  const classes = [...new Set(located.map((d) => d.class))];
  // Severity is the job here, not identity — every one of these is something to
  // walk over and look at. Confidence sizes the mark; the count carries the rest.
  const points: MapPoint[] = metres.map((m, i) => ({
    ...toUnitSquare(m, span),
    weight: located[i].confidence,
    tone: 'bad' as const,
  }));

  const scaleM = pickScaleMetres(span);
  const spread = describeSpread(metres, span);
  // Worst-case tier across everything on this map, so the plot cannot look
  // more authoritative than its least reliable mark.
  const worstTier = located
    .map((d) => describeReliability(d.cross_source_reliability))
    .reduce((a, b) => (b.severity > a.severity ? b : a));

  const fixes = located.filter((d) => typeof d.fix_quality === 'number');
  const dgps = fixes.filter((d) => d.fix_quality === 2).length;
  const worstHdop = located.reduce<number | null>(
    (acc, d) => (typeof d.hdop === 'number' && (acc === null || d.hdop > acc) ? d.hdop : acc),
    null,
  );

  // Healthy-class detections (a positive "this is healthy rice" call) are on
  // the map too, in green: where the pod looked and found nothing wrong is part
  // of the picture. Everything else is something to walk over and look at.
  const toneOf = (c: string): Tone =>
    describeClass(c).category === 'healthy' ? 'good' : 'bad';

  const geo: GeoPoint[] = located.map((d) => ({
    lat: d.lat,
    lon: d.lon,
    tone: toneOf(d.class),
    label: describeClass(d.class).condition,
    sub: `${describeClass(d.class).crop ?? ''}${d.captured_utc ? ` · ${new Date(d.captured_utc).toLocaleTimeString(dateLocale(), { hour: 'numeric', minute: '2-digit' })}` : ''}`,
  }));

  const gpsLine = [
    gps?.point_count !== undefined ? tr('{n} GPS fixes', { n: gps.point_count }) : null,
    dgps > 0 ? tr('{a} of {b} differential', { a: dgps, b: fixes.length }) : null,
    worstHdop !== null ? tr('worst spread {v}', { v: worstHdop.toFixed(1) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card eyebrow={tr('Where')} title={tr('Where in the field')}>
      {/* The reading, in words, above the map. */}
      {spread ? (
        <View style={s.verdictRow}>
          <Text style={[type.label, { color: color.foreground }]}>{tr(SPREAD_LABEL[spread.verdict] ?? spread.verdict)}</Text>
          <Text style={[type.small, { color: color.mutedForeground, marginTop: 2 }]}>
            {SPREAD_COPY[spread.verdict](Math.round(spread.meanSeparationM))}
          </Text>
        </View>
      ) : null}

      <SatelliteMap
        points={geo}
        fallback={
          <View style={s.plotWrap}>
            <FieldMap points={points} scaleLabel={`${scaleM} m`} scaleFraction={scaleM / span} />
          </View>
        }
      />

      <MapLegend
        items={[
          ...classes.map((c) => ({ label: describeClass(c).condition, tone: toneOf(c) })),
        ]}
      />

      {/* The caveat is the point. Without it the map over-promises. */}
      <Text style={[type.small, { color: color.warningForeground, marginTop: space.sm }]}>
        {tr('Each circle is about {m} m across the GPS error, so it marks a patch of the field, not one plant. Use it to find the area, then look around it.', { m: FIX_RADIUS_M })}
      </Text>

      {/* A map is persuasive in a way a list is not, so the reliability of what
          is on it travels with it rather than living only on the card above. */}
      {worstTier.severity >= 2 ? (
        <Panel label={tr('How much to trust the marks')} tone={TIER_TONE[String(worstTier.tier)] ?? 'bad'}>
          {worstTier.body}
        </Panel>
      ) : null}

      {unlocated > 0 ? (
        <Text style={[type.small, { color: color.unknown, marginTop: space.sm }]}>
          {unlocated === 1
            ? tr('1 more finding has no position and is not on the map. The finding is real even where the position is not.')
            : tr('{n} more findings have no position and are not on the map. The finding is real even where the position is not.', { n: unlocated })}
        </Text>
      ) : null}

      {gpsLine ? (
        <Text style={[type.valueSmall, { color: color.fgSubtle, marginTop: space.sm }]}>
          {gpsLine}
        </Text>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  verdictRow: { marginBottom: space.md },
  plotWrap: { alignItems: 'center', paddingVertical: space.sm },
  statRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  findingRow: { borderTopWidth: 1, borderTopColor: color.border },
  findingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
  },
  more: { paddingVertical: space.sm, alignSelf: 'flex-start' },
});
