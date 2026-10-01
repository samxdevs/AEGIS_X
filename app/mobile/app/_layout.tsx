import { useEffect, useState } from 'react';
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
import { FieldsIcon, HomeIcon, PodIcon, ProfileIcon } from '../src/ui/tab-icons.tsx';
import { color, font, type } from '../src/ui/theme.ts';
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
      <LanguageProvider initial={language}>
        <AppTabs />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

/**
 * Three places, always one tap away: home (the scans), the fields they came from,
 * and the pod they are pulled from. The bar stays visible on an open advisory
 * too — see (scans)/_layout.tsx.
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
        // Sized explicitly: with Montserrat the default bar clipped the bottom
        // of its labels. Setting a height means adding the gesture-bar inset
        // by hand, which the default would otherwise have done.
        tabBarStyle: {
          backgroundColor: color.card,
          borderTopColor: color.border,
          height: 70 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 6 + insets.bottom,
        },
        tabBarLabelStyle: { fontFamily: font.sansMedium, fontSize: 11.5, lineHeight: 15 },
        headerStyle: { backgroundColor: color.background },
        headerShadowVisible: false,
        headerTintColor: color.foreground,
        headerTitleStyle: { fontFamily: font.sansBold, fontSize: 16.5 },
        sceneStyle: { backgroundColor: color.background },
      }}
    >
      <Tabs.Screen
        name="(scans)"
        options={{
          title: tr('Home'),
          headerShown: false,
          tabBarIcon: ({ color: c }) => <HomeIcon color={c} />,
        }}
      />
      <Tabs.Screen
        name="fields"
        options={{
          title: tr('Fields'),
          tabBarIcon: ({ color: c }) => <FieldsIcon color={c} />,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: tr('Pod'),
          headerTitle: tr('Pod & sync'),
          tabBarIcon: ({ color: c }) => <PodIcon color={c} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: tr('Profile'),
          tabBarIcon: ({ color: c }) => <ProfileIcon color={c} />,
        }}
      />
    </Tabs>
  );
}
