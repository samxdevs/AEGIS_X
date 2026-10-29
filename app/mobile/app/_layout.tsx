import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import {
  SourceCodePro_400Regular,
  SourceCodePro_600SemiBold,
} from '@expo-google-fonts/source-code-pro';

import { revalidateAll } from '../src/db/advisories.ts';
import { getDb } from '../src/db/client.ts';
import { seedFixturesIfEmpty } from '../src/db/seed.ts';
import { loadLlmSettings } from '../src/llm/settings.ts';
import { FieldsIcon, HomeIcon, MicIcon, PodIcon, ProfileIcon } from '../src/ui/tab-icons.tsx';
import { color, font, radius, shadow, type } from '../src/ui/theme.ts';
import type { Scheme } from '../src/ui/theme.ts';
import { ThemeProvider, loadSavedScheme } from '../src/ui/theme-mode.tsx';
import { TopBar } from '../src/ui/top-bar.tsx';
import { BAR_HEIGHT, FLOAT_GAP, FLOAT_SIDE } from '../src/ui/floating-bar.ts';
import { LanguageProvider, loadSavedLanguage, useLanguage } from '../src/i18n/language.tsx';
import type { AppLanguage } from '../src/i18n/tr.ts';
import { tr } from '../src/i18n/tr.ts';

export default function RootLayout() {
  const [fontsReady] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_700Bold,
    SourceCodePro_400Regular,
    SourceCodePro_600SemiBold,
  });
  const [dbReady, setDbReady] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('en');
  const [scheme, setScheme] = useState<Scheme>('light');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // §14.2 step 1 — the store comes up before anything else. The app is fully
    // usable from here on with no pod, no field station and no network.
    (async () => {
      try {
        await getDb();
        // Order matters. Replace stale sample data first, then re-check what is
        // left against the current validator — a record that was valid when it
        // was stored can fail the contract as it stands today, and its stored
        // verdict has to say so before any screen reads it.
        await seedFixturesIfEmpty();
        await revalidateAll();
        // The farmer's language, before the first screen draws, so a Hindi
        // reader never sees the app flash up in English.
        setLanguage(await loadSavedLanguage());
        // Likewise the light/dark choice, so a dark phone never flashes white.
        setScheme(await loadSavedScheme());
        // The AI provider and key, so the advisory screen knows on its first
        // render whether it can offer an explanation.
        await loadLlmSettings();
        setDbReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: color.background, padding: 24, justifyContent: 'center' }}>
        <Text style={[type.title, { color: color.destructive, marginBottom: 8 }]}>
          Local store failed to open
        </Text>
        <Text style={[type.body, { color: color.foreground }]}>{error}</Text>
      </View>
    );
  }

  if (!fontsReady || !dbReady) {
    return (
      <View style={{ flex: 1, backgroundColor: color.background, justifyContent: 'center' }}>
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {/* No root <StatusBar>: it mounts after the first screen's focus effect
          and overwrote the light style the history band needs. Each screen
          sets its own with useStatusBarStyle. */}
      <ThemeProvider initial={scheme}>
        <LanguageProvider initial={language}>
          <AppTabs />
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** The active tab's icon sits in a soft pill, like a native nav indicator. */
function NavIcon({ focused, children }: { focused: boolean; children: ReactNode }) {
  return (
    <View
      style={{
        width: 54,
        height: 30,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? color.secondary : 'transparent',
      }}
    >
      {children}
    </View>
  );
}

/**
 * The places always one tap away: home (the scans), the fields they came from,
 * the Ask tab in the middle where a thumb finds it, and the pod they are pulled
 * from. The bar stays visible on an open advisory too — see (scans)/_layout.tsx.
 */
function AppTabs() {
  // Inside SafeAreaProvider, so the inset is real.
  const insets = useSafeAreaInsets();
  // Tab labels and headers follow the language.
  useLanguage();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.fgSubtle,
        // A floating pill, lifted off the bottom edge and the sides. Sized
        // explicitly: with Montserrat the default bar clipped the bottom of its
        // labels. It floats above the gesture bar, so the inset is the gap.
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          marginHorizontal: FLOAT_SIDE,
          bottom: insets.bottom + FLOAT_GAP,
          height: BAR_HEIGHT,
          paddingTop: 0,
          paddingBottom: 0,
          borderRadius: radius.pill,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: color.border,
          // Slightly see-through, so the page is felt behind the bar.
          backgroundColor: color.card + 'F6',
          ...shadow.lifted,
        },
        tabBarItemStyle: { paddingVertical: 7 },
        tabBarLabelStyle: { fontFamily: font.sansMedium, fontSize: 11.5, lineHeight: 15 },
        // Tabs cross-fade rather than cut.
        animation: 'fade',
        // One top bar for every tab, the same band Home draws.
        header: ({ options }) => (
          <TopBar title={typeof options.headerTitle === 'string' ? options.headerTitle : options.title} />
        ),
        // No bottom padding: the bar floats over the page and content scrolls
        // under it. Each screen pads its own scroll area (useBarClearance).
        sceneStyle: { backgroundColor: color.background },
      }}
    >
      <Tabs.Screen
        name="(scans)"
        options={{
          title: tr('Home'),
          headerShown: false,
          tabBarIcon: ({ color: c, focused }) => (
            <NavIcon focused={focused}>
              <HomeIcon color={c} />
            </NavIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="fields"
        options={{
          title: tr('Fields'),
          tabBarIcon: ({ color: c, focused }) => (
            <NavIcon focused={focused}>
              <FieldsIcon color={c} />
            </NavIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: tr('Ask'),
          headerTitle: tr('Ask about your fields'),
          tabBarIcon: ({ color: c, focused }) => (
            <NavIcon focused={focused}>
              <MicIcon color={c} />
            </NavIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: tr('Pod'),
          headerTitle: tr('Pod & sync'),
          tabBarIcon: ({ color: c, focused }) => (
            <NavIcon focused={focused}>
              <PodIcon color={c} />
            </NavIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: tr('Profile'),
          tabBarIcon: ({ color: c, focused }) => (
            <NavIcon focused={focused}>
              <ProfileIcon color={c} />
            </NavIcon>
          ),
        }}
      />
    </Tabs>
  );
}
