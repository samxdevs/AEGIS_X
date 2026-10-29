/**
 * The one top bar every screen shares.
 *
 * A deep-green band with rounded bottom corners, the same inverted section the
 * site opens on, drawn under the status bar. Home shows the wordmark and a
 * sync pill; every other screen shows a round back button (when something is
 * under it) and its title. One component means the Fields, Pod, Profile and
 * scan screens can no longer drift from Home, and the status bar is light on
 * all of them.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AegisMark, AegisWordmark } from './brand.tsx';
import { color, radius, space, themed, type } from './theme.ts';
import { tr } from '../i18n/tr.ts';

export type PillTone = 'idle' | 'good' | 'warn' | 'bad';

const PILL: Record<PillTone, { dot: string; text: string }> = {
  idle: { dot: '#99AA9A', text: '#C9D4CA' },
  good: { dot: '#66BB6A', text: '#C8E6C9' },
  warn: { dot: '#F0A830', text: '#F5D9A4' },
  bad: { dot: '#F0716A', text: '#F6C3BF' },
};

/** A small status pill that sits on the band. Tappable when `onPress` is given. */
export function BandPill({
  label,
  tone = 'idle',
  onPress,
}: {
  label: string;
  tone?: PillTone;
  onPress?: () => void;
}) {
  const p = PILL[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      hitSlop={8}
      style={({ pressed }) => [s.pill, pressed && { opacity: 0.7 }]}
    >
      <View style={[s.pillDot, { backgroundColor: p.dot }]} />
      <Text style={[type.chipLabel, { color: p.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function BackChevron() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5l-7 7 7 7"
        stroke="#F8F5F0"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TopBar({
  title,
  subtitle,
  brand = false,
  onBack,
  right,
  note,
}: {
  title?: string;
  subtitle?: string;
  /** Home: the wordmark in place of a title. */
  brand?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  /** A line of plain text under the row, such as what a sync pill means. */
  note?: string | null;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.band, { paddingTop: insets.top + space.md }]}>
      <View style={s.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={tr('Back')}
            hitSlop={8}
            style={({ pressed }) => [s.back, pressed && { opacity: 0.6 }]}
          >
            <BackChevron />
          </Pressable>
        ) : null}

        {brand ? (
          <View style={s.brand}>
            <AegisMark size={24} color={color.primary} />
            <AegisWordmark height={15} color={color.deepForeground} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={[type.title, s.title]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[type.small, { color: color.deepMuted, marginTop: 1 }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        )}

        {brand ? <View style={{ flex: 1 }} /> : null}
        {right}
      </View>
      {note ? <Text style={[type.small, s.note]}>{note}</Text> : null}
    </View>
  );
}

const s = themed(() =>
  StyleSheet.create({
    band: {
      backgroundColor: color.deep,
      paddingHorizontal: space.lg,
      paddingBottom: space.lg,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      // Lifts the band off the page in dark, where the ground is nearly as deep.
      borderBottomWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: color.deepBorder,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40 },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    back: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(248,245,240,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { color: color.deepForeground, fontSize: 21, lineHeight: 26 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(248,245,240,0.08)',
      borderWidth: 1,
      borderColor: color.deepBorder,
    },
    pillDot: { width: 7, height: 7, borderRadius: 4 },
    note: { color: color.deepMuted, marginTop: space.sm },
  }),
);
