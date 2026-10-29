/**
 * The Home tab: the dashboard, the full scan list, a scan pushed on top, and
 * the live screen for a walk in progress.
 *
 * A stack inside the tab rather than beside it, so the bottom bar stays on
 * screen while a scan is open. One tap on Home always gets back to the
 * dashboard, as does the labelled back button in the header.
 */

import { Stack, useRouter } from 'expo-router';

import { color } from '../../src/ui/theme.ts';
import { TopBar } from '../../src/ui/top-bar.tsx';
import { useLanguage } from '../../src/i18n/language.tsx';
import { tr } from '../../src/i18n/tr.ts';

export default function ScansLayout() {
  useLanguage();
  const router = useRouter();
  // A back button that still works when the screen was opened directly (from
  // the map's popup, say) with nothing under it in the stack.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: color.background },
        header: ({ options }) => (
          <TopBar title={typeof options.title === 'string' ? options.title : undefined} onBack={goBack} />
        ),
      }}
    >
      {/* The dashboard draws its own inverted header band. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="all" options={{ title: tr('All scans') }} />
      <Stack.Screen name="advisory/[id]" options={{ title: tr('Scan') }} />
      {/* The walk in progress. Leaving it does not stop the walk. */}
      <Stack.Screen name="live" options={{ title: tr('Scanning') }} />
    </Stack>
  );
}
