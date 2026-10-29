/**
 * A round badge that says the verdict before any word is read: a tick for
 * healthy, an exclamation for something to look at, a triangle for a finding,
 * a question mark for not measured or unclear.
 *
 * Shape as well as colour, so it still reads in sun and in grayscale. The
 * words next to it carry the verdict; this is the glance. `plate` fills the
 * circle when it sits on a band of its own tone and would otherwise vanish.
 */

import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { TONE } from './components.tsx';
import type { Tone } from './components.tsx';

const stroke = { strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

function Glyph({ tone, c }: { tone: Tone; c: string }) {
  switch (tone) {
    case 'good':
      return <Path d="M7 12.5l3.2 3.2L17 8.8" stroke={c} {...stroke} />;
    case 'bad':
      return (
        <>
          <Path d="M12 7.2v5.6" stroke={c} {...stroke} />
          <Circle cx={12} cy={16.4} r={1.2} fill={c} />
        </>
      );
    case 'warn':
      return (
        <>
          <Path d="M12 6.8v6" stroke={c} {...stroke} />
          <Circle cx={12} cy={16.6} r={1.2} fill={c} />
        </>
      );
    case 'unknown':
      return (
        <>
          <Path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2.9-1.2 1.7" stroke={c} {...stroke} />
          <Circle cx={12} cy={16.8} r={1.1} fill={c} />
        </>
      );
    default:
      return <Path d="M8 12h8" stroke={c} {...stroke} />;
  }
}

export function VerdictIcon({ tone, size = 40, plate }: { tone: Tone; size?: number; plate?: string }) {
  const t = TONE[tone];
  const pop = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, speed: 14, bounciness: 12, useNativeDriver: true }).start();
  }, [pop]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: plate ?? t.bg,
        borderWidth: 1.5,
        borderColor: t.fg,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pop }],
      }}
    >
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
        <Glyph tone={tone} c={t.fg} />
      </Svg>
    </Animated.View>
  );
}
