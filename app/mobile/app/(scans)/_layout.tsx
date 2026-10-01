/**
 * The Home tab: the dashboard, the full scan list, and a scan pushed on top.
 *
 * A stack inside the tab rather than beside it, so the bottom bar stays on
 * screen while a scan is open. One tap on Home always gets back to the
 * dashboard, as does the labelled back button in the header.
 */

import { Pressable, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { color, font, space, type } from '../../src/ui/theme.ts';
import { useLanguage } from '../../src/i18n/language.tsx';
import { tr } from '../../src/i18n/tr.ts';

/**
 * A worded back button rather than a bare arrow: it is a larger target for a
 * thumb in a field, and it still works when the screen was opened directly
 * (from the map's popup, say) with nothing under it in the stack.
 */
function BackButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      accessibilityRole="button"
      accessibilityLabel={tr('Back to {where}', { where: label })}
      hitSlop={12}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: space.md,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={[type.title, { color: color.primary, marginRight: 4 }]}>‹</Text>
      <Text style={[type.label, { color: color.primary }]}>{label}</Text>
    </Pressable>
  );
}

export default function ScansLayout() {
  useLanguage();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.background },
        headerShadowVisible: false,
        headerTintColor: color.foreground,
        // The stack header only accepts fontFamily/fontSize/fontWeight/color,
        // so the tracking from the type ramp cannot be applied here.
        headerTitleStyle: { fontFamily: font.sansBold, fontSize: 16.5 },
        contentStyle: { backgroundColor: color.background },
        headerBackVisible: false,
        headerLeft: () => <BackButton label={tr('Back')} />,
      }}
    >
      {/* The dashboard draws its own inverted header band. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="all"
        options={{ title: tr('All scans'), headerLeft: () => <BackButton label={tr('Home')} /> }}
      />
      <Stack.Screen name="advisory/[id]" options={{ title: tr('Scan') }} />
    </Stack>
  );
}
