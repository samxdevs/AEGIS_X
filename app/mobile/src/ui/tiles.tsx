/**
 * Icons and small graphics for the field-reading tiles.
 *
 * The readings grid on the scan screen is laid out like a weather app: one
 * tile per reading, an icon, one big number, and a small graphic that places
 * the number on its scale. These are those graphics.
 *
 * Each is a status mark, not decoration: the fill colour follows the same
 * good / warn / bad ramp as the rest of the app, and every graphic sits beside
 * the number and words it illustrates, never instead of them.
 */

import type { ColorValue } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Line, Path, Rect, Stop } from 'react-native-svg';

import type { Tone } from './components.tsx';
import { chart, color } from './theme.ts';

const FILL: Record<Tone, string> = {
  good: chart.fill.good,
  warn: chart.fill.warn,
  bad: chart.fill.bad,
  unknown: chart.fill.unknown,
  // Between good and warn on a status ramp: lime, not the brown text colour,
  // so a 'mild' band reads as a step on the scale rather than as a fault.
  neutral: '#A4B83A',
};
const TRACK: Record<Tone, string> = {
  good: chart.track.good,
  warn: chart.track.warn,
  bad: chart.track.bad,
  unknown: chart.track.unknown,
  neutral: '#E9EDCF',
};

// ---- Icons ----------------------------------------------------------------

type IconProps = { color: ColorValue; size?: number };
const line = { strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

export function ThermometerIcon({ color: c, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0z" stroke={c} {...line} />
      <Path d="M12 9v6.5" stroke={c} {...line} />
    </Svg>
  );
}

export function DropIcon({ color: c, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3.5c3.5 4.5 6 7.8 6 10.8a6 6 0 0 1-12 0c0-3 2.5-6.3 6-10.8z" stroke={c} {...line} />
    </Svg>
  );
}

export function LeafIcon({ color: c, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" stroke={c} {...line} />
      <Path d="M5 19l8-8" stroke={c} {...line} />
    </Svg>
  );
}

export function SatelliteIcon({ color: c, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={9} y={9} width={6} height={6} rx={1} stroke={c} {...line} transform="rotate(45 12 12)" />
      <Path d="M5.5 5.5l3 3M15.5 15.5l3 3M3.5 9.5l6-6M14.5 20.5l6-6" stroke={c} {...line} />
    </Svg>
  );
}

export function SproutIcon({ color: c, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 20v-8" stroke={c} {...line} />
      <Path d="M12 12c0-3.5-2.5-5.5-6.5-5.5 0 3.5 2.5 5.5 6.5 5.5z" stroke={c} {...line} />
      <Path d="M12 14c0-3.5 2.5-5.5 6.5-5.5 0 3.5-2.5 5.5-6.5 5.5z" stroke={c} {...line} />
    </Svg>
  );
}

export function BugIcon({ color: c, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={8} y={8} width={8} height={11} rx={4} stroke={c} {...line} />
      <Path d="M9.5 6.5 8 4.5M14.5 6.5 16 4.5M8 12H4.5M16 12h3.5M8 16l-3 1.5M16 16l3 1.5" stroke={c} {...line} />
    </Svg>
  );
}

// ---- Graphics -------------------------------------------------------------

/**
 * A half-dial for a 0 to 1 index, with its bands drawn round the rim and a
 * needle at the value. Used for the water stress index.
 */
export function ArcGauge({
  value,
  bands,
  width = 120,
}: {
  value: number;
  bands: { upTo: number; tone: Tone }[];
  width?: number;
}) {
  const h = width / 2 + 8;
  const cx = width / 2;
  const cy = width / 2;
  const r = width / 2 - 8;
  const pt = (f: number) => {
    const a = Math.PI * (1 - Math.max(0, Math.min(1, f)));
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };
  let from = 0;
  const arcs = bands.map((b) => {
    const p0 = pt(from + 0.01);
    const p1 = pt(b.upTo - 0.01);
    from = b.upTo;
    return { d: `M${p0.x} ${p0.y} A${r} ${r} 0 0 1 ${p1.x} ${p1.y}`, tone: b.tone };
  });
  const n = pt(value);
  return (
    <Svg width={width} height={h}>
      {arcs.map((a, i) => (
        <Path key={i} d={a.d} stroke={FILL[a.tone]} strokeWidth={8} strokeLinecap="butt" fill="none" />
      ))}
      <Line x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={color.foreground} strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={cx} cy={cy} r={4} fill={color.foreground} />
    </Svg>
  );
}

/**
 * A gradient scale with a marker: cool to hot for temperature, bare soil to
 * dense green for a greenness index. The gradient is the scale; the ring marks
 * where this reading sits on it.
 */
export function GradientScale({
  value,
  min,
  max,
  kind,
  width = 132,
}: {
  value: number;
  min: number;
  max: number;
  kind: 'temperature' | 'green';
  width?: number;
}) {
  const stops =
    kind === 'temperature'
      ? ['#5AA9E6', '#7BC47F', '#F2C94C', '#F2994A', '#EB5757']
      : ['#A1887F', '#D4C27A', '#9CCC65', '#43A047', '#1B5E20'];
  const f = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const h = 18;
  const x = 7 + f * (width - 14);
  const id = `g-${kind}`;
  return (
    <Svg width={width} height={h}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          {stops.map((c, i) => (
            <Stop key={c} offset={i / (stops.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={2} y={6} width={width - 4} height={6} rx={3} fill={`url(#${id})`} />
      <Circle cx={x} cy={9} r={6} fill={color.card} stroke={color.foreground} strokeWidth={2} />
    </Svg>
  );
}

/** A plain progress bar, with an optional threshold tick. */
export function ProgressBar({
  fraction,
  tone,
  tick,
  width = 132,
  fill,
  track,
}: {
  fraction: number;
  tone: Tone;
  /** Overrides the tone's colours, for a quantity that is not a status (water). */
  fill?: string;
  track?: string;
  /** 0 to 1: where a threshold sits, drawn as a small upright line. */
  tick?: number;
  width?: number;
}) {
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <Svg width={width} height={14}>
      <Rect x={0} y={4} width={width} height={6} rx={3} fill={track ?? TRACK[tone]} />
      <Rect x={0} y={4} width={Math.max(6, f * width)} height={6} rx={3} fill={fill ?? FILL[tone]} />
      {typeof tick === 'number' ? (
        <Rect x={tick * width - 1} y={0} width={2} height={14} rx={1} fill={color.foreground} />
      ) : null}
    </Svg>
  );
}

/** One dot per item, coloured by its status. Used for the pests on a trap. */
export function Dots({ tones }: { tones: Tone[] }) {
  return (
    <Svg width={tones.length * 16} height={14}>
      <G>
        {tones.map((t, i) => (
          <Circle key={i} cx={7 + i * 16} cy={7} r={6} fill={FILL[t]} />
        ))}
      </G>
    </Svg>
  );
}
