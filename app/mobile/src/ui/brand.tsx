/**
 * The AEGIS marks, ported from `web/components/ui/bits.tsx`.
 *
 * The letterform path data is copied verbatim from `AEGIS_LETTERFORMS` there,
 * so the wordmark in the app is the same drawing as the one on the site and on
 * the aircraft — not a font approximation of it, and not a redraw that will
 * drift from the original the first time either side is touched.
 */

import Svg, { Circle, G, Path } from 'react-native-svg';

/**
 * AEGIS on a 0-495 x 0-100 grid: crossbar-less A, geometric E, G with a
 * mid-height bar, I, and a two-arc S.
 */
export const AEGIS_LETTERFORMS = [
  'M0,100 L42,0 L84,100',
  'M133.5,0 V100 M133.5,3.5 H192 M133.5,50 H184 M133.5,96.5 H192',
  'M320.8,28.75 A42.5,42.5 0 1 0 326.5,50 L296,50',
  'M379.5,0 V100',
  'M484.66,14.93 A25,25 0 1 0 462,50.5 A25,25 0 1 1 439.34,85.07',
];

/**
 * Drawn rather than set: a thin geometric construction with uniform stroke
 * weight, so it stays a hairline at any size.
 */
export function AegisWordmark({
  height = 18,
  color = '#3E2723',
  strokeWidth = 8,
}: {
  height?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      height={height}
      width={(height * 507) / 112}
      viewBox="-6 -6 507 112"
      fill="none"
      accessibilityRole="image"
      accessibilityLabel="AEGIS"
    >
      <G stroke={color} strokeWidth={strokeWidth} strokeLinecap="butt" strokeLinejoin="miter">
        {AEGIS_LETTERFORMS.map((d) => (
          <Path key={d} d={d} />
        ))}
      </G>
    </Svg>
  );
}

/** The shield glyph that sits beside the wordmark. */
export function AegisMark({ size = 22, color = '#2E7D32' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.2 20.5 7v10L12 21.8 3.5 17V7z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M8.4 8.4 15.6 15.6M15.6 8.4 8.4 15.6" stroke={color} strokeWidth={1.2} />
      <Circle cx={8.4} cy={8.4} r={1.8} fill={color} />
      <Circle cx={15.6} cy={8.4} r={1.8} fill={color} />
      <Circle cx={8.4} cy={15.6} r={1.8} fill={color} />
      <Circle cx={15.6} cy={15.6} r={1.8} fill={color} />
    </Svg>
  );
}
