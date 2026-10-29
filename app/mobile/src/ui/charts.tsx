/**
 * The plotting primitives.
 *
 * ── Why these and not a chart library ───────────────────────────────────────
 * Almost nothing this app shows is a series over time. It is a handful of
 * bounded readings, each of which has to carry *whether it can be trusted*
 * alongside its value. A generic chart library renders the number and drops the
 * caveat, which is the one thing this app exists to preserve.
 *
 * ── Colour ──────────────────────────────────────────────────────────────────
 * These are **status** marks, not categorical ones: a small fixed scale with
 * reserved meaning, good → warning → serious. That distinction matters because
 * status colour is never allowed to be the only channel — every mark here ships
 * with a written label beside it, so the chart still reads under any colour
 * vision, in direct sun, or in a grayscale screenshot on a slide.
 *
 * Marks are thin, fills are flat, grid rules are hairlines one shade off the
 * surface and never dashed. Adjacent fills are separated by a 2px gap of the
 * surface colour rather than by a stroke around each one.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { chart, color, radius, space, type, themed, live } from './theme.ts';
import type { Tone } from './components.tsx';

const TONE_FILL: Record<Tone, string> = live(() => ({
  good: chart.fill.good,
  warn: chart.fill.warn,
  bad: chart.fill.bad,
  unknown: chart.fill.unknown,
  neutral: chart.muted,
}));

const TONE_TRACK: Record<Tone, string> = live(() => ({
  good: chart.track.good,
  warn: chart.track.warn,
  bad: chart.track.bad,
  unknown: chart.track.unknown,
  neutral: color.muted,
}));

// ---- Meter ----------------------------------------------------------------

export type MeterBand = {
  /** Upper edge of the band, in the meter's own units. */
  upTo: number;
  label: string;
  tone: Tone;
};

/**
 * A bounded value against its scale, with the bands that give it meaning.
 *
 * The fill carries severity and the unfilled track is a lighter step of the
 * same hue, so the state reads across the whole bar rather than only up to the
 * fill edge.
 *
 * Band edges are drawn as hairline ticks with the one that matters labelled —
 * a number under every tick is noise, and the reader only needs to know where
 * the value sits relative to the next boundary.
 */
export function Meter({
  value,
  min = 0,
  max = 1,
  bands,
  tone,
  caption,
  markerLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  bands?: MeterBand[];
  tone: Tone;
  caption?: string;
  /** Drawn under the fill edge. The one direct label this mark gets. */
  markerLabel?: string;
}) {
  const span = max - min || 1;
  const frac = Math.max(0, Math.min(1, (value - min) / span));

  return (
    <View style={{ marginTop: space.sm }}>
      <View style={s.meterTrackWrap}>
        <View style={[s.meterTrack, { backgroundColor: TONE_TRACK[tone] }]}>
          <View
            style={[
              s.meterFill,
              {
                width: `${frac * 100}%`,
                backgroundColor: TONE_FILL[tone],
              },
            ]}
          />
          {/* Band edges. Hairlines in the surface colour, so they read as
              punched gaps rather than as strokes drawn over the fill. */}
          {(bands ?? []).slice(0, -1).map((b) => {
            const x = Math.max(0, Math.min(1, (b.upTo - min) / span));
            return (
              <View
                key={b.upTo}
                style={[s.meterTick, { left: `${x * 100}%` }]}
                pointerEvents="none"
              />
            );
          })}
        </View>
      </View>

      <View style={s.meterLegend}>
        <Text style={[type.valueSmall, { color: color.fgSubtle }]}>{min}</Text>
        {markerLabel ? (
          <Text style={[type.valueSmall, { color: color.mutedForeground }]}>{markerLabel}</Text>
        ) : null}
        <Text style={[type.valueSmall, { color: color.fgSubtle }]}>{max}</Text>
      </View>

      {caption ? (
        <Text style={[type.small, { color: color.mutedForeground, marginTop: 6 }]}>{caption}</Text>
      ) : null}
    </View>
  );
}

// ---- Evidence bar ---------------------------------------------------------

export type EvidenceSegment = { count: number; label: string; tone: Tone };

/**
 * How the frames voted, as a part-to-whole bar.
 *
 * This is the honest form for a classifier verdict on this project. Held-out
 * accuracy against camera sources the model has never seen is far below its
 * accuracy on familiar ones, so a confidence figure alone invites more trust
 * than it has earned. How many frames agreed, and how many were thrown away, is
 * something a farmer and a judge can both weigh.
 *
 * Segments are separated by a 2px gap of the surface colour, never by a border
 * drawn around each one, and every segment is named in the legend beneath.
 */
export function EvidenceBar({ segments }: { segments: EvidenceSegment[] }) {
  const shown = segments.filter((x) => x.count > 0);
  const total = shown.reduce((n, x) => n + x.count, 0);
  if (total === 0) return null;

  return (
    <View style={{ marginTop: space.sm }}>
      <View style={s.evidenceTrack}>
        {shown.map((seg, i) => (
          <View
            key={seg.label}
            style={{
              flex: seg.count,
              backgroundColor: TONE_FILL[seg.tone],
              // The gap is punched in the surface colour between fills.
              marginLeft: i === 0 ? 0 : chart.gap,
              borderTopLeftRadius: i === 0 ? radius.pill : 0,
              borderBottomLeftRadius: i === 0 ? radius.pill : 0,
              borderTopRightRadius: i === shown.length - 1 ? radius.pill : 0,
              borderBottomRightRadius: i === shown.length - 1 ? radius.pill : 0,
            }}
          />
        ))}
      </View>

      <View style={s.evidenceLegend}>
        {shown.map((seg) => (
          <View key={seg.label} style={s.legendItem}>
            <View style={[s.legendSwatch, { backgroundColor: TONE_FILL[seg.tone] }]} />
            <Text style={[type.valueSmall, { color: color.mutedForeground }]}>
              {seg.count} {seg.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---- Distribution strip ---------------------------------------------------

/**
 * Where one reading sits inside its own field's spread.
 *
 * This is the whole argument of the vegetation block made visual. There are no
 * published absolute bands for these indices — their value moves with the
 * light, the camera and the sun angle — so the only defensible comparison is
 * the field against itself, in one session. That comparison is a *position in a
 * distribution*, and a bare number cannot show it.
 *
 * The p10–p90 spread is the track, the median is a hairline, and the reading is
 * the one marked point. Nothing else is labelled: the reader needs to know
 * where this sits, not what every percentile was.
 */
export function DistributionStrip({
  value,
  p10,
  p50,
  p90,
  tone,
}: {
  value: number;
  p10: number;
  p50?: number;
  p90: number;
  tone: Tone;
}) {
  // Pad the axis a little past the observed spread so a reading sitting exactly
  // at p10 or p90 is not drawn half outside the track.
  const lo = Math.min(p10, value);
  const hi = Math.max(p90, value);
  const pad = (hi - lo) * 0.15 || 1;
  const min = lo - pad;
  const span = hi + pad - min || 1;
  const at = (x: number) => Math.max(0, Math.min(1, (x - min) / span)) * 100;

  return (
    <View style={{ marginTop: space.sm }}>
      <View style={s.stripWrap}>
        {/* Axis hairline: solid, one shade off the surface. */}
        <View style={s.stripAxis} />

        {/* The field's own middle 80%. */}
        <View
          style={[
            s.stripRange,
            {
              left: `${at(p10)}%`,
              width: `${at(p90) - at(p10)}%`,
              backgroundColor: TONE_TRACK[tone],
            },
          ]}
        />

        {p50 !== undefined ? (
          <View style={[s.stripMedian, { left: `${at(p50)}%` }]} />
        ) : null}

        {/* The reading. A 2px surface ring keeps it legible where it overlaps
            the range fill. */}
        <View
          style={[
            s.stripPoint,
            { left: `${at(value)}%`, backgroundColor: TONE_FILL[tone] },
          ]}
        />
      </View>

      <View style={s.stripLegend}>
        <Text style={[type.valueSmall, { color: color.fgSubtle }]}>{round(p10)}</Text>
        <Text style={[type.valueSmall, { color: color.fgSubtle }]}>
          field spread
        </Text>
        <Text style={[type.valueSmall, { color: color.fgSubtle }]}>{round(p90)}</Text>
      </View>
    </View>
  );
}

const round = (n: number) => (Math.abs(n) >= 10 ? n.toFixed(0) : n.toFixed(2));

// ---- Stat tile ------------------------------------------------------------

/**
 * A single number with its caption. The number *is* the chart — a one-bar bar
 * chart would say less and take more room.
 */
export function Stat({
  value,
  caption,
  tone = 'neutral',
  hero = false,
}: {
  value: string;
  caption: string;
  tone?: Tone;
  /** Exactly one per screen. Proportional figures, same sans as everything. */
  hero?: boolean;
}) {
  return (
    <View style={s.stat}>
      {/* One line, shrunk to fit: a word like "untested" in a third-width
          column otherwise breaks mid-word as "untest / ed". */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          hero ? type.hero : type.stat,
          { color: tone === 'neutral' ? color.foreground : TONE_FILL[tone] },
        ]}
      >
        {value}
      </Text>
      <Text style={[type.small, { color: color.mutedForeground, marginTop: 4 }]}>{caption}</Text>
    </View>
  );
}

// ---- Field map ------------------------------------------------------------

export type MapPoint = {
  x: number;
  y: number;
  /** 0–1. Sizes the mark; never the only channel. */
  weight: number;
  tone: Tone;
};

/**
 * The field plot.
 *
 * Deliberately not a basemap. The pod tags each detection with a handheld fix
 * at roughly 2.5 m, no RTK, which locates a corner of a field rather than a
 * plant — drawing those points over a street or satellite tile would imply a
 * precision the receiver does not have, and zooming to plant level would imply
 * it harder. There is also no tile provider to call: a map that had to download
 * anything would be the one screen that stopped working in a field, in a system
 * whose whole claim is that it needs no cloud.
 *
 * So this answers the question the data can actually support — are the findings
 * clustered in one part of the field, or spread through it — with a graticule
 * for reference, a scale bar in metres, and north marked.
 */
export function FieldMap({
  points,
  size = 260,
  scaleLabel,
  scaleFraction,
  children,
}: {
  points: MapPoint[];
  size?: number;
  /** e.g. "20 m". Drawn beside the scale bar. */
  scaleLabel?: string;
  /** Scale bar length as a fraction of the plot's inner width. */
  scaleFraction?: number;
  children?: ReactNode;
}) {
  const pad = 20;
  const inner = size - pad * 2;
  const bar = (scaleFraction ?? 0.25) * inner;

  return (
    <Svg width={size} height={size}>
      <Rect
        x={0.5}
        y={0.5}
        width={size - 1}
        height={size - 1}
        rx={10}
        fill={color.background}
        stroke={color.border}
        strokeWidth={1}
      />

      {/* Graticule. Solid hairlines, one shade off the surface, never dashed. */}
      <G>
        {[0.25, 0.5, 0.75].map((f) => (
          <Line
            key={`v${f}`}
            x1={pad + inner * f}
            y1={pad}
            x2={pad + inner * f}
            y2={pad + inner}
            stroke={chart.grid}
            strokeWidth={1}
          />
        ))}
        {[0.25, 0.5, 0.75].map((f) => (
          <Line
            key={`h${f}`}
            x1={pad}
            y1={pad + inner * f}
            x2={pad + inner}
            y2={pad + inner * f}
            stroke={chart.grid}
            strokeWidth={1}
          />
        ))}
        <Rect
          x={pad}
          y={pad}
          width={inner}
          height={inner}
          fill="none"
          stroke={chart.axis}
          strokeWidth={1}
        />
      </G>

      {/* North arrow. A field plot without one invites the wrong reading. */}
      <G>
        <Polygon
          points={`${size - pad - 5},${pad - 8} ${size - pad - 9},${pad + 1} ${size - pad - 1},${pad + 1}`}
          fill={color.mutedForeground}
        />
        <SvgText
          x={size - pad - 5}
          y={pad + 11}
          fontSize={8}
          fill={color.mutedForeground}
          textAnchor="middle"
          fontFamily="SourceCodePro_400Regular"
        >
          N
        </SvgText>
      </G>

      {points.map((p, i) => (
        <G key={i}>
          {/* Halo, then the mark, then a surface ring so overlapping points stay
              countable. Minimum 8px across even at zero weight. */}
          <Circle
            cx={pad + p.x * inner}
            cy={pad + p.y * inner}
            r={9 + p.weight * 7}
            fill={TONE_FILL[p.tone]}
            fillOpacity={0.14}
          />
          <Circle
            cx={pad + p.x * inner}
            cy={pad + p.y * inner}
            r={4.5 + p.weight * 2}
            fill={TONE_FILL[p.tone]}
            stroke={color.background}
            strokeWidth={2}
          />
        </G>
      ))}

      {/* Scale bar — the only thing on this plot with a unit. */}
      <G>
        <Line
          x1={pad}
          y1={size - 9}
          x2={pad + bar}
          y2={size - 9}
          stroke={color.mutedForeground}
          strokeWidth={2}
        />
        {scaleLabel ? (
          <SvgText
            x={pad + bar + 6}
            y={size - 6}
            fontSize={9}
            fill={color.mutedForeground}
            fontFamily="SourceCodePro_400Regular"
          >
            {scaleLabel}
          </SvgText>
        ) : null}
      </G>

      {children}
    </Svg>
  );
}

/** The legend a map with more than one mark colour must carry. */
export function MapLegend({ items }: { items: { label: string; tone: Tone }[] }) {
  if (items.length === 0) return null;
  return (
    <View style={s.mapLegend}>
      {items.map((it) => (
        <View key={it.label} style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: TONE_FILL[it.tone] }]} />
          <Text style={[type.valueSmall, { color: color.mutedForeground }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  meterTrackWrap: { justifyContent: 'center' },
  meterTrack: {
    height: 12,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  meterFill: { height: 12, borderRadius: radius.pill },
  meterTick: {
    position: 'absolute',
    width: chart.gap,
    top: 0,
    bottom: 0,
    backgroundColor: color.card,
  },
  meterLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    gap: space.sm,
  },

  evidenceTrack: { flexDirection: 'row', height: 12, alignItems: 'stretch' },
  evidenceLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    marginTop: space.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 9, height: 9, borderRadius: 2 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },

  stripWrap: { height: 22, justifyContent: 'center' },
  stripAxis: { height: 1, backgroundColor: chart.axis },
  stripRange: { position: 'absolute', height: 10, borderRadius: radius.pill },
  stripMedian: {
    position: 'absolute',
    width: 1,
    height: 16,
    backgroundColor: chart.axis,
  },
  stripPoint: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    marginLeft: -5.5,
    borderWidth: 2,
    borderColor: color.card,
  },
  stripLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: space.sm,
  },

  stat: { flex: 1 },

  mapLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    marginTop: space.sm,
    justifyContent: 'center',
  },
}));
