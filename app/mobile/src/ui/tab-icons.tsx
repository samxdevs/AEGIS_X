/**
 * The three bottom-bar icons, drawn rather than pulled from an icon font.
 *
 * The app ships no icon set, and three outlines do not justify adding one.
 * Each is a 24-unit line drawing at the site's 1.8 stroke, tinted by the tab
 * bar's active / inactive colour so the label and icon always agree.
 */

import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type IconProps = { color: ColorValue; size?: number };

const stroke = { strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

/** A house with a leaf in its door: home, for a farm. */
export function HomeIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3.5 11 12 4l8.5 7" stroke={color} {...stroke} />
      <Path d="M5.5 9.5V20h13V9.5" stroke={color} {...stroke} />
      <Path d="M10 20c0-3.5 1.5-5.5 4.5-6-.3 3.2-1.8 5-4.5 6z" stroke={color} {...stroke} />
    </Svg>
  );
}

/** Four plots in a grid: one tile per field. */
export function FieldsIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3.5} y={3.5} width={7.5} height={7.5} rx={1.5} stroke={color} {...stroke} />
      <Rect x={13} y={3.5} width={7.5} height={7.5} rx={1.5} stroke={color} {...stroke} />
      <Rect x={3.5} y={13} width={7.5} height={7.5} rx={1.5} stroke={color} {...stroke} />
      <Rect x={13} y={13} width={7.5} height={7.5} rx={1.5} stroke={color} {...stroke} />
    </Svg>
  );
}

/** A head and shoulders: the farmer's profile. */
export function ProfileIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8.5} r={3.8} stroke={color} {...stroke} />
      <Path d="M4.5 20c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6" stroke={color} {...stroke} />
    </Svg>
  );
}

/** A point radiating: the pod's local WiFi link. */
export function PodIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={16} r={1.8} fill={color} />
      <Path d="M8.5 12.5a5 5 0 0 1 7 0" stroke={color} {...stroke} />
      <Path d="M5.5 9.5a9.2 9.2 0 0 1 13 0" stroke={color} {...stroke} />
    </Svg>
  );
}
