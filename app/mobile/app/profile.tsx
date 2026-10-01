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
import { tr } from '../src/i18n/tr.ts';
import { AiSettingsCard } from '../src/ui/ai-settings.tsx';
import { useStatusBarStyle } from '../src/ui/status-bar.ts';
import { ProfileIcon } from '../src/ui/tab-icons.tsx';
import { color, radius, shadow, space, type } from '../src/ui/theme.ts';

const OPTIONS: { code: AppLanguage; name: string; sample: string }[] = [
  { code: 'en', name: 'English', sample: 'Looks healthy' },
  { code: 'hi', name: 'हिंदी', sample: 'फसल स्वस्थ दिखती है' },
];

export default function ProfileScreen() {
  const { language, setLanguage } = useLanguage();
  useStatusBarStyle('dark');

  return (
    <ScrollView
      style={{ backgroundColor: color.background }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 3 }}
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

      <AiSettingsCard />
    </ScrollView>
  );
}

const s = StyleSheet.create({
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
});
