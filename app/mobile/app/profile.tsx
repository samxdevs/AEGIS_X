/**
 * Profile: the language the whole app speaks, and the AI provider and key.
 *
 * The language is saved on the phone and applies to every screen at once:
 * labels, verdicts, advice, reading tiles and dates. The heading is always
 * written in both languages, so someone who cannot read the current one can
 * still find the way back. The AI card is ai-settings.tsx.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '../src/i18n/language.tsx';
import type { AppLanguage } from '../src/i18n/tr.ts';
import { msg, tr } from '../src/i18n/tr.ts';
import { AiSettingsCard } from '../src/ui/ai-settings.tsx';
import { Reveal } from '../src/ui/motion.tsx';
import { useBarClearance } from '../src/ui/floating-bar.ts';
import { useStatusBarStyle } from '../src/ui/status-bar.ts';
import { ProfileIcon } from '../src/ui/tab-icons.tsx';
import { color, palettes, radius, shadow, space, type, themed } from '../src/ui/theme.ts';
import type { Scheme } from '../src/ui/theme.ts';
import { useScheme } from '../src/ui/theme-mode.tsx';

const OPTIONS: { code: AppLanguage; name: string; sample: string }[] = [
  { code: 'en', name: 'English', sample: 'Looks healthy' },
  { code: 'hi', name: 'हिंदी', sample: 'फसल स्वस्थ दिखती है' },
];

const LOOKS: { code: Scheme; name: string; note: string }[] = [
  { code: 'light', name: msg('Light'), note: msg('Best in bright sun.') },
  { code: 'dark', name: msg('Dark'), note: msg('Easier on the eyes at night and indoors.') },
];

export default function ProfileScreen() {
  const { language, setLanguage } = useLanguage();
  const { scheme, setScheme } = useScheme();
  useStatusBarStyle('light');
  const clearance = useBarClearance();

  return (
    <ScrollView
      style={{ backgroundColor: color.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: clearance }}
      // The key field sits low on the screen; the keyboard must not cover it.
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <View style={s.identity}>
        <View style={s.avatar}>
          <ProfileIcon color={color.secondaryForeground} size={30} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: color.foreground }]}>{tr('Your profile')}</Text>
          <Text style={[type.small, { color: color.mutedForeground, marginTop: 2 }]}>
            {tr('Settings for this phone.')}
          </Text>
        </View>
      </View>

      <Reveal index={1}>
      <View style={[s.card, { marginBottom: space.lg }]}>
        {/* Both languages, always: the way back must be readable in either. */}
        <Text style={[type.cardTitle, { color: color.foreground }]}>Appearance · दिखावट</Text>
        <Text style={[type.small, { color: color.mutedForeground, marginTop: 4, marginBottom: space.md }]}>
          {tr('Changes every screen in the app.')}
        </Text>
        <View style={s.looks}>
          {LOOKS.map((o) => {
            const active = o.code === scheme;
            const p = palettes[o.code];
            return (
              <Pressable
                key={o.code}
                onPress={() => setScheme(o.code)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={o.code === 'light' ? 'Light' : 'Dark'}
                style={({ pressed }) => [s.look, active && s.lookActive, pressed && { opacity: 0.7 }]}
              >
                {/* A miniature of the screen in that scheme, so the choice is seen, not read. */}
                <View style={[s.swatch, { backgroundColor: p.background, borderColor: p.border }]}>
                  <View style={[s.swatchBand, { backgroundColor: p.deep }]} />
                  <View style={[s.swatchCard, { backgroundColor: p.card, borderColor: p.border }]}>
                    <View style={[s.swatchLine, { backgroundColor: p.foreground, width: '60%' }]} />
                    <View style={[s.swatchLine, { backgroundColor: p.fgSubtle, width: '85%' }]} />
                    <View style={[s.swatchPill, { backgroundColor: p.primary }]} />
                  </View>
                </View>
                <Text style={[type.label, { color: active ? color.secondaryForeground : color.foreground, marginTop: space.sm }]}>
                  {tr(o.name)}
                </Text>
                <Text style={[type.small, { color: color.mutedForeground, marginTop: 2 }]}>{tr(o.note)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      </Reveal>

      <Reveal index={2}>
      <View style={s.card}>
        {/* Both languages, always: the way back must be readable in either. */}
        <Text style={[type.cardTitle, { color: color.foreground }]}>Language · भाषा</Text>
        <Text style={[type.small, { color: color.mutedForeground, marginTop: 4, marginBottom: space.md }]}>
          {tr('Changes every screen in the app, including the advice. Works without internet.')}
        </Text>

        {OPTIONS.map((o) => {
          const active = o.code === language;
          return (
            <Pressable
              key={o.code}
              onPress={() => setLanguage(o.code)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={o.code === 'en' ? 'English' : 'Hindi'}
              style={({ pressed }) => [s.option, active && s.optionActive, pressed && { opacity: 0.7 }]}
            >
              <View style={[s.radio, active && s.radioActive]}>
                {active ? <View style={s.radioDot} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: active ? color.secondaryForeground : color.foreground }]}>
                  {o.name}
                </Text>
                <Text style={[type.small, { color: color.mutedForeground, marginTop: 2 }]}>
                  {o.sample}
                </Text>
              </View>
            </Pressable>
          );
        })}

        <Text style={[type.small, { color: color.fgSubtle, marginTop: space.md }]}>
          {tr('Technical messages from the pod, and the scan code on each scan, stay in English.')}
        </Text>
      </View>
      </Reveal>

      <Reveal index={3}>
        <AiSettingsCard />
      </Reveal>
    </ScrollView>
  );
}

const s = themed(() => StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: color.secondary,
    borderWidth: 1,
    borderColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    ...shadow.card,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  looks: { flexDirection: 'row', gap: space.md },
  look: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    padding: space.sm,
  },
  lookActive: { borderColor: color.primary, backgroundColor: color.secondary, borderWidth: 2, padding: space.sm - 1 },
  swatch: { height: 84, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  swatchBand: { height: 14 },
  swatchCard: { margin: 8, flex: 1, borderRadius: radius.sm, borderWidth: 1, padding: 6, gap: 4 },
  swatchLine: { height: 4, borderRadius: 2 },
  swatchPill: { height: 8, width: 26, borderRadius: 4, marginTop: 2 },
  optionActive: { borderColor: color.primary, backgroundColor: color.secondary, borderWidth: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: color.fgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: color.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.primary },
}));
